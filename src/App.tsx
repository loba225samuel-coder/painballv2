import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaintballGame, type HudState, type RunResult, type Status } from "@/game/engine";
import Hud from "@/components/Hud";
import { GameOverScreen, PauseScreen, ResumeCard, StartScreen } from "@/components/Screens";
import OnlinePanel from "@/components/Online";
import { ProgressPanel, WorldBoard } from "@/components/Progress";
import GameSheet from "@/components/Sheet";
import { bestScore, loadScores, saveScore, type ScoreRow } from "@/lib/scores";
import { NetRoom, makeRoomCode, type NetStatus } from "@/game/net";
import {
  connect,
  submitRun,
  fetchWorld,
  fetchProgress,
  setName as setCloudName,
  loadLocal,
  saveLocal,
  clearLocal,
  pushSave,
  pullSave,
  clearSave,
  type LinkState,
  type Progress as ProgressT,
  type WorldRow,
  type StoredSave,
} from "@/lib/cloud";
import { Maximize } from "lucide-react";

const EMPTY_HUD: HudState = {
  hp: 6,
  maxHp: 6,
  score: 0,
  wave: 1,
  combo: 1,
  comboPct: 0,
  enemies: 0,
  coverage: 0,
  ammo: 12,
  mag: 12,
  time: 0,
  dashPct: 1,
  powerName: "",
  powerPct: 0,
  shield: 0,
  duo: false,
  p2: null,
};

/* --- plein écran / verrouillage d'écran (iOS n'a pas l'API) --- */
const fsElement = () =>
  (document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) ??
  null;

async function goFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

async function leaveFullscreen() {
  try {
    const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (d.exitFullscreen && fsElement()) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* noop */
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<PaintballGame | null>(null);
  const wakeRef = useRef<{ release: () => void } | null>(null);
  const autoFsRef = useRef(false);
  const netRef = useRef<NetRoom | null>(null);
  const roleRef = useRef<"host" | "guest">("host");

  const [status, setStatus] = useState<Status>("menu");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [result, setResult] = useState<RunResult | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("pb.muted") === "1");
  const [vibe, setVibe] = useState(() => localStorage.getItem("pb.vibe") !== "0");
  const [toast, setToast] = useState<string | null>(null);
  const [duo, setDuo] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* multijoueur en ligne */
  const [netStatus, setNetStatus] = useState<NetStatus>("idle");
  const [netDetail, setNetDetail] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [netSdp, setNetSdp] = useState("");

  /* progression en ligne */
  const [link, setLink] = useState<LinkState>("checking");
  const [world, setWorld] = useState<WorldRow[] | null>(null);
  const [prog, setProg] = useState<ProgressT | null>(null);

  /* partie sauvegardée (reprendre plus tard) */
  const [saveInfo, setSaveInfo] = useState<StoredSave | null>(null);

  const isTouch = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)")?.matches,
    []
  );
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.innerHeight > window.innerWidth
  );

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  /* ---------------- moteur ---------------- */
  useEffect(() => {
    setRows(loadScores());
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new PaintballGame(canvas, {
      onHud: setHud,
      onStatus: setStatus,
      onGameOver: (r) => {
        setResult(r);
        setRank(null);
      },
    });
    gameRef.current = game;

    let rt = 0;
    const remeasure = () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => game.resize(), 60);
    };
    const onOrient = () => {
      setPortrait(window.innerHeight > window.innerWidth);
      remeasure();
    };
    // Sur mobile la taille change sans événement fiable (barre d'URL, clavier,
    // rotation) : on observe l'élément lui-même plutôt que la fenêtre.
    const ro = new ResizeObserver(() => remeasure());
    // on observe le conteneur ET le canvas : si le canvas est lui-même dimensionné
    // par le CSS, observer le seul canvas ne verrait jamais l'écran grandir.
    ro.observe(canvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", remeasure);
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", onOrient);
    onOrient();
    game.resize();
    // le viewport mobile se stabilise après coup : on remesure aux moments critiques
    const retries = [80, 260, 700, 1600, 3000].map((ms) => window.setTimeout(() => game.resize(), ms));
    const onFsChange = () => setFullscreen(!!fsElement());
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", onOrient);
      vv?.removeEventListener("resize", remeasure);
      ro.disconnect();
      retries.forEach((id) => clearTimeout(id));
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      clearTimeout(rt);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  // une rotation pendant une partie = pause, pas de morts gratuites
  useEffect(() => {
    if (isTouch && status === "playing") gameRef.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait]);

  /* ---------------- écran allumé ---------------- */
  useEffect(() => {
    const wanted = isTouch && status === "playing";
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => void; type: string }> };
    };
    if (wanted && !wakeRef.current && nav.wakeLock) {
      nav.wakeLock
        .request("screen")
        .then((lock) => {
          wakeRef.current = lock;
        })
        .catch(() => {
          /* refusé : pas grave */
        });
    }
    if (!wanted && wakeRef.current) {
      try {
        wakeRef.current.release();
      } catch {
        /* noop */
      }
      wakeRef.current = null;
    }
    const relock = () => {
      if (document.visibilityState === "visible" && wanted && !wakeRef.current && nav.wakeLock) {
        nav.wakeLock.request("screen").then((l) => (wakeRef.current = l)).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", relock);
    return () => document.removeEventListener("visibilitychange", relock);
  }, [status, isTouch]);

  /* ---------------- actions ---------------- */
  const start = useCallback(
    async (duoMode: boolean = duo) => {
      setResult(null);
      setRank(null);
      if (isTouch && !autoFsRef.current && !fsElement()) {
        autoFsRef.current = true;
        const ok = await goFullscreen();
        if (!ok && typeof (document.documentElement as HTMLElement).requestFullscreen !== "function") {
          say("PLEIN ÉCRAN : AJOUTE LE JEU À L'ÉCRAN D'ACCUEIL POUR LE LANCER SANS BARRE DE NAVIGATION");
        }
      }
      gameRef.current?.start(duoMode);
    },
    [isTouch, say, duo]
  );

  const toMenu = useCallback(() => {
    setResult(null);
    setRank(null);
    gameRef.current?.toMenu();
  }, []);

  const toggleMute = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setMuted(g.toggleMute());
  }, []);

  const toggleVibe = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setVibe(g.toggleVibe());
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fsElement()) {
      await leaveFullscreen();
      setFullscreen(false);
      return;
    }
    const ok = await goFullscreen();
    setFullscreen(!!fsElement());
    if (!ok) say("PLEIN ÉCRAN NON DISPO SUR CE NAVIGATEUR — PASSE PAR « AJOUTER À L'ÉCRAN D'ACCUEIL »");
  }, [say]);

  /* ---------------- sauvegarde de partie ---------------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = loadLocal();
      if (local) {
        if (alive) setSaveInfo(local);
        return;
      }
      const remote = await pullSave();
      if (alive && remote) setSaveInfo(remote);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveAndQuit = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const s = g.exportSave();
    if (!s) {
      say("SAUVEGARDE IMPOSSIBLE EN CETTE FIN DE PARTIE");
      return;
    }
    saveLocal(s);
    void pushSave(s);
    setSaveInfo({ label: s.label, wave: s.wave, score: s.score, at: s.at, payload: s });
    g.toMenu();
    say("PARTIE SAUVEGARDÉE — REPRESSE « REPRENDRE » QUAND TU VEUX");
  }, [say]);

  const resumeSave = useCallback(() => {
    const s = saveInfo;
    if (!s) return;
    setResult(null);
    setRank(null);
    gameRef.current?.importSave(s.payload);
  }, [saveInfo]);

  const discardSave = useCallback(() => {
    clearLocal();
    void clearSave();
    setSaveInfo(null);
    say("SAUVEGARDE SUPPRIMÉE");
  }, [say]);

  /* ---------------- multijoueur en ligne ---------------- */
  const ensureNet = useCallback(() => {
    if (netRef.current) return netRef.current;
    const room = new NetRoom((ev) => {
      if (ev.type === "status") {
        setNetStatus(ev.status);
        setNetDetail(ev.detail);
        if (ev.type === "status" && ev.status === "manual") setNetSdp(netRef.current?.localSdp ?? "");
      } else if (ev.type === "connected") {
        const g = gameRef.current;
        if (!g) return;
        const host = roleRef.current === "host";
        g.setLocalIndex(host ? 0 : 1);
        g.setNetPilot(host ? 1 : 0);
        void start(true);
      } else if (ev.type === "input") {
        gameRef.current?.setRemoteInput(ev.input);
      } else if (ev.type === "state") {
        gameRef.current?.applySnapshot(ev.state);
      } else if (ev.type === "closed") {
        gameRef.current?.setNetPilot(null);
        gameRef.current?.setLocalIndex(0);
        setNetStatus("idle");
      }
    });
    netRef.current = room;
    return room;
  }, [start]);

  const hostRoom = useCallback(() => {
    roleRef.current = "host";
    const code = makeRoomCode();
    setRoomCode(code);
    void ensureNet().host(code);
  }, [ensureNet]);

  const joinRoom = useCallback(
    (code: string) => {
      if (code.length < 4) return;
      roleRef.current = "guest";
      setRoomCode(code);
      void ensureNet().join(code);
    },
    [ensureNet]
  );

  const cancelRoom = useCallback(() => {
    netRef.current?.close("salon quitté");
    gameRef.current?.setNetPilot(null);
    gameRef.current?.setLocalIndex(0);
    setNetStatus("idle");
    setRoomCode("");
    setNetSdp("");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const room = netRef.current;
    if (!room || !room.live) return;
    const host = roleRef.current === "host";
    const id = window.setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      if (host) room.sendState(g.getSnapshot());
      else room.sendInput(g.getLocalInput());
    }, host ? 50 : 33);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => () => netRef.current?.close("page fermée"), []);

  /* ---------------- progression en ligne ---------------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await connect();
      if (!alive) return;
      setLink(s);
      const [w, p] = await Promise.all([fetchWorld(), fetchProgress()]);
      if (!alive) return;
      if (w) setWorld(w);
      if (p) setProg(p);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // toute partie terminée est déposée dans la base (repli local si hors ligne)
  useEffect(() => {
    if (!result) return;
    clearLocal();
    void clearSave();
    setSaveInfo(null);
    const name = localStorage.getItem("pb.name") || "ACE";
    void (async () => {
      const ok = await submitRun({
        name,
        score: result.score,
        wave: result.wave,
        kills: result.kills,
        kills2: result.kills2,
        accuracy: result.shots > 0 ? Math.round((result.hits / result.shots) * 100) : 0,
        coverage: Math.round(result.coverage * 100),
        duration: Math.round(result.time),
        duo: result.duo,
      });
      if (!ok) return;
      const [w, p] = await Promise.all([fetchWorld(), fetchProgress()]);
      if (w) setWorld(w);
      if (p) setProg(p);
    })();
  }, [result]);

  /* ---------------- raccourcis hors partie ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = gameRef.current?.status;
      if (s === "menu" && (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter")) {
        e.preventDefault();
        void start();
      } else if (s === "gameover" && (e.code === "KeyR" || e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        void start();
      } else if (s === "paused" && (e.code === "Enter" || e.code === "KeyR")) {
        e.preventDefault();
        void start();
      } else if (e.code === "KeyM") {
        toggleMute();
      } else if (e.code === "KeyV") {
        toggleVibe();
      } else if (e.code === "KeyF") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start, toggleMute, toggleVibe, toggleFullscreen]);

  const handleSave = useCallback(
    (name: string) => {
      if (rank !== null || !result) return;
      const out = saveScore({
        name: name || "ACE",
        score: result.score,
        wave: result.wave,
        kills: result.kills,
        coverage: result.coverage,
        date: Date.now(),
      });
      localStorage.setItem("pb.name", name || "ACE");
      void setCloudName(name || "ACE");
      setRows(out.rows);
      setRank(out.rank - 1);
    },
    [rank, result]
  );

  /* ---------------- nœuds d'interface ---------------- */
  const progressNode = (
    <div className="flex flex-col gap-3">
      <ProgressPanel progress={prog} status={link} />
      <WorldBoard rows={world} status={link} />
    </div>
  );

  const onlineNode = (
    <OnlinePanel
      status={netStatus}
      detail={netDetail}
      code={roomCode}
      localSdp={netSdp}
      onHost={hostRoom}
      onJoin={joinRoom}
      onManualAnswer={(sdp) => void ensureNet().acceptAnswer(sdp)}
      onManualJoin={(sdp) => void ensureNet().manualJoin(sdp)}
      onCancel={cancelRoom}
    />
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-court-900">
      <canvas
        ref={canvasRef}
        className={"absolute inset-0 h-full w-full " + (status === "playing" ? "cursor-none" : "cursor-default")}
      />

      <div
        className="scanlines pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: status === "playing" && !isTouch ? 1 : 0 }}
      />

      {(status === "playing" || status === "paused") && (
        <Hud
          hud={hud}
          muted={muted}
          vibe={vibe}
          isTouch={isTouch}
          portrait={portrait}
          onPause={() => gameRef.current?.togglePause()}
          onMute={toggleMute}
          onVibe={toggleVibe}
          onFullscreen={toggleFullscreen}
        />
      )}

      {status === "menu" && (
        <StartScreen
          onStart={() => void start(duo)}
          duo={duo}
          onDuo={setDuo}
          resume={saveInfo ? <ResumeCard save={saveInfo} onResume={resumeSave} onDiscard={discardSave} /> : null}
          online={<>
            {onlineNode}
            <GameSheet />
            {progressNode}
          </>}
          rows={rows}
          best={bestScore(rows)}
          muted={muted}
          onMute={toggleMute}
          isTouch={isTouch}
          vibe={vibe}
          onVibe={toggleVibe}
          fullscreen={fullscreen}
          onFullscreen={() => void toggleFullscreen()}
          portrait={portrait}
        />
      )}

      {status === "paused" && (
        <PauseScreen
          onResume={() => gameRef.current?.resume()}
          onRestart={() => void start()}
          onMenu={toMenu}
          onSaveQuit={saveAndQuit}
          wave={hud.wave}
          score={hud.score}
          isTouch={isTouch}
          muted={muted}
          vibe={vibe}
          onMute={toggleMute}
          onVibe={toggleVibe}
        />
      )}

      {status === "gameover" && result && (
        <GameOverScreen
          result={result}
          rows={rows}
          savedRank={rank}
          onSave={handleSave}
          onRestart={() => void start()}
          onMenu={toMenu}
          isTouch={isTouch}
          muted={muted}
          onMute={toggleMute}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="panel anim-pop flex items-center gap-2 px-3 py-2">
            <Maximize className="h-4 w-4 shrink-0 text-gold" />
            <p className="font-cond text-[11px] font-extrabold leading-tight tracking-[0.14em] text-chalk">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
