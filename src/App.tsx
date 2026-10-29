import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaintballGame, type HudState, type RunResult, type Status } from "@/game/engine";
import { MultiplayerGame, type MpHud, type MpResult } from "@/game/multiplayer";
import type { MpMode } from "@/game/mpSim";
import Hud from "@/components/Hud";
import Multiplayer from "@/components/Multiplayer";
import Progression from "@/components/Progression";
import { GameOverScreen, PauseScreen, StartScreen } from "@/components/Screens";
import { bestScore, loadScores, saveScore, type ScoreRow } from "@/lib/scores";
import { useProgression } from "@/hooks/useProgression";
import { Maximize } from "lucide-react";

const EMPTY_HUD: HudState = {
  hp: 6, maxHp: 6, score: 0, wave: 1, combo: 1, comboPct: 0, enemies: 0, coverage: 0,
  ammo: 12, mag: 12, time: 0, dashPct: 1, powerName: "", powerPct: 0, powers: [],
};

const EMPTY_MP: MpHud = {
  transport: "local", connection: "offline", phase: "lobby", mode: "coop", code: "", hostId: null, meId: "",
  localPaused: false, countdown: 0, wave: 0, time: 0, timeLeft: 90, teamScore: 0, combo: 1, comboPct: 0,
  enemies: 0, coverage: 0, ping: 0, players: [], gamepads: 0,
};

const SERVER_URL =
  import.meta.env.VITE_MULTIPLAYER_URL ||
  (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "ws://localhost:8787" : "");

const fsElement = () =>
  (document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) ?? null;

async function goFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
}

async function leaveFullscreen() {
  try {
    const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (d.exitFullscreen && fsElement()) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch { /* noop */ }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soloRef = useRef<PaintballGame | null>(null);
  const mpRef = useRef<MultiplayerGame | null>(null);
  const wakeRef = useRef<{ release: () => void } | null>(null);
  const autoFsRef = useRef(false);
  const appliedProfile = useRef<string | null>(null);
  const lastSoloResult = useRef<RunResult | null>(null);
  const lastMpResult = useRef<MpResult | null>(null);

  const prog = useProgression();
  const [progressOpen, setProgressOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);

  const [active, setActive] = useState<"solo" | "mp">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "multi" ? "mp" : "solo"
  );
  const [status, setStatus] = useState<Status>("menu");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [result, setResult] = useState<RunResult | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const [mpHud, setMpHud] = useState<MpHud>(EMPTY_MP);
  const [mpResult, setMpResult] = useState<MpResult | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpMenuOpen, setMpMenuOpen] = useState(false);

  const [muted, setMuted] = useState(() => localStorage.getItem("pb.muted") === "1");
  const [vibe, setVibe] = useState(() => localStorage.getItem("pb.vibe") !== "0");
  const [toast, setToast] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);

  const isTouch = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)")?.matches, []);
  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  /* ---------------- moteurs ---------------- */
  useEffect(() => {
    setRows(loadScores());
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (active === "solo") {
      const game = new PaintballGame(canvas, {
        onHud: setHud,
        onStatus: setStatus,
        onGameOver: (r) => { setResult(r); setRank(null); },
      });
      soloRef.current = game;
    } else {
      const game = new MultiplayerGame(canvas, {
        onHud: setMpHud,
        onResult: (r) => { setMpResult(r); setMpMenuOpen(false); },
        onError: (m) => { setMpError(m); say(m); },
        onPauseIntent: () => setMpMenuOpen(true),
      });
      mpRef.current = game;
    }

    let rt = 0;
    const timers: number[] = [];
    const engine = () => (active === "solo" ? soloRef.current : mpRef.current);
    const resize = () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => engine()?.resize(), 40);
    };
    // iOS/Android peuvent publier la nouvelle taille en plusieurs temps.
    const burstResize = () => {
      engine()?.resize();
      resize();
      timers.push(window.setTimeout(() => engine()?.resize(), 120));
      timers.push(window.setTimeout(() => engine()?.resize(), 350));
    };
    const isPortraitNow = () => {
      const type = screen.orientation?.type;
      if (type) return type.startsWith("portrait");
      return window.innerHeight > window.innerWidth;
    };
    const onOrient = () => {
      setPortrait(isPortraitNow());
      burstResize();
    };
    const onFs = () => {
      setFullscreen(!!fsElement());
      burstResize();
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    window.visualViewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", onOrient);
    screen.orientation?.addEventListener?.("change", onOrient);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    onOrient();
    return () => {
      ro?.disconnect();
      window.visualViewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", onOrient);
      screen.orientation?.removeEventListener?.("change", onOrient);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      clearTimeout(rt);
      timers.forEach(clearTimeout);
      soloRef.current?.destroy();
      mpRef.current?.destroy();
      soloRef.current = null;
      mpRef.current = null;
    };
  }, [active, say]);

  useEffect(() => {
    if (!isTouch) return;
    if (active === "solo" && status === "playing") soloRef.current?.pause();
    if (active === "mp" && mpHud.transport === "local" && mpHud.phase === "playing" && !mpHud.localPaused) mpRef.current?.togglePause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait]);

  /* ---------------- wake lock ---------------- */
  useEffect(() => {
    const wanted =
      isTouch &&
      ((active === "solo" && status === "playing") ||
        (active === "mp" && (mpHud.phase === "playing" || mpHud.phase === "countdown") && mpHud.connection !== "offline"));
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => void }> } };
    if (wanted && !wakeRef.current && nav.wakeLock) {
      nav.wakeLock.request("screen").then((l) => (wakeRef.current = l)).catch(() => {});
    }
    if (!wanted && wakeRef.current) {
      try { wakeRef.current.release(); } catch { /* noop */ }
      wakeRef.current = null;
    }
    const relock = () => {
      if (document.visibilityState === "visible" && wanted && !wakeRef.current && nav.wakeLock) {
        nav.wakeLock.request("screen").then((l) => (wakeRef.current = l)).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", relock);
    return () => document.removeEventListener("visibilitychange", relock);
  }, [active, status, mpHud.phase, mpHud.connection, isTouch]);

  /* ---------------- progression cloud ---------------- */
  const profileId = prog.profile?.id;
  useEffect(() => {
    const p = prog.profile;
    if (!p || appliedProfile.current === p.id) return;
    appliedProfile.current = p.id;
    if (typeof p.settings.muted === "boolean") {
      setMuted(p.settings.muted);
      localStorage.setItem("pb.muted", p.settings.muted ? "1" : "0");
      soloRef.current?.sfx.setMuted(p.settings.muted);
      mpRef.current?.sfx.setMuted(p.settings.muted);
    }
    if (typeof p.settings.vibe === "boolean") {
      setVibe(p.settings.vibe);
      for (const g of [soloRef.current, mpRef.current]) {
        if (g && g.vibeOn !== p.settings.vibe) g.toggleVibe();
      }
    }
    if (p.display_name) localStorage.setItem("pb.name", p.display_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (!result || lastSoloResult.current === result) return;
    lastSoloResult.current = result;
    void prog.recordRun({
      mode: "solo",
      score: result.score,
      wave: result.wave,
      kills: result.kills,
      shots: result.shots,
      hits: result.hits,
      max_combo: result.maxCombo,
      coverage: result.coverage,
      duration: result.time,
      won: null,
      details: { source: "solo" },
    });
  }, [result, prog.recordRun]);

  useEffect(() => {
    if (!mpResult || lastMpResult.current === mpResult) return;
    lastMpResult.current = mpResult;
    const me = mpResult.players.find((p) => p.isMe) ?? mpResult.players[0];
    if (!me) return;
    void prog.recordRun({
      mode: mpResult.mode,
      score: mpResult.mode === "versus" ? me.finalScore : me.score,
      wave: mpResult.wave,
      kills: me.kills,
      shots: me.shots,
      hits: me.hits,
      max_combo: 0,
      coverage: me.coverage,
      duration: mpResult.time,
      won: mpResult.mode === "versus" ? mpResult.winnerId === me.id : null,
      details: {
        transport: mpResult.transport,
        teamScore: mpResult.teamScore,
        players: mpResult.players.map((p) => ({ name: p.name, score: p.finalScore, kills: p.kills })),
      },
    });
  }, [mpResult, prog.recordRun]);

  /* ---------------- actions ---------------- */
  const ensureFullscreen = useCallback(async () => {
    if (!isTouch || autoFsRef.current || fsElement()) return;
    autoFsRef.current = true;
    const ok = await goFullscreen();
    if (!ok && typeof (document.documentElement as HTMLElement).requestFullscreen !== "function") {
      say("PLEIN ÉCRAN : AJOUTE LE JEU À L'ÉCRAN D'ACCUEIL POUR UNE VUE SANS BARRE");
    }
  }, [isTouch, say]);

  const startSolo = useCallback(async () => {
    setResult(null);
    setRank(null);
    await ensureFullscreen();
    soloRef.current?.start();
  }, [ensureFullscreen]);

  const openMultiplayer = useCallback(async () => {
    setMpResult(null);
    setMpError(null);
    setMpMenuOpen(false);
    setMpHud(EMPTY_MP);
    setActive("mp");
    await ensureFullscreen();
  }, [ensureFullscreen]);

  const backToSolo = useCallback(() => {
    mpRef.current?.leave();
    setMpResult(null);
    setMpError(null);
    setMpMenuOpen(false);
    setActive("solo");
  }, []);

  const startLocal = useCallback(async (mode: MpMode) => {
    setMpResult(null);
    setMpError(null);
    setMpMenuOpen(false);
    await ensureFullscreen();
    mpRef.current?.startLocal(mode);
  }, [ensureFullscreen]);

  const createRoom = useCallback(async (name: string, mode: MpMode) => {
    setMpResult(null);
    setMpError(null);
    await ensureFullscreen();
    mpRef.current?.createRoom(name, mode, SERVER_URL);
  }, [ensureFullscreen]);

  const joinRoom = useCallback(async (code: string, name: string) => {
    setMpResult(null);
    setMpError(null);
    await ensureFullscreen();
    mpRef.current?.joinRoom(code, name, SERVER_URL);
  }, [ensureFullscreen]);

  const leaveRoom = useCallback(() => {
    mpRef.current?.leave();
    setMpResult(null);
    setMpError(null);
    setMpMenuOpen(false);
    setMpHud(EMPTY_MP);
  }, []);

  const toggleMute = useCallback(() => {
    const g = active === "solo" ? soloRef.current : mpRef.current;
    if (!g) return;
    const m = g.toggleMute();
    setMuted(m);
    void prog.saveSettings({ muted: m });
  }, [active, prog.saveSettings]);

  const toggleVibe = useCallback(() => {
    const g = active === "solo" ? soloRef.current : mpRef.current;
    if (!g) return;
    const v = g.toggleVibe();
    setVibe(v);
    void prog.saveSettings({ vibe: v });
  }, [active, prog.saveSettings]);

  const toggleFullscreen = useCallback(async () => {
    if (fsElement()) {
      await leaveFullscreen();
      setFullscreen(false);
      return;
    }
    const ok = await goFullscreen();
    setFullscreen(!!fsElement());
    if (!ok) say("PLEIN ÉCRAN NON DISPO — UTILISE « AJOUTER À L'ÉCRAN D'ACCUEIL »");
  }, [say]);

  const mpPause = useCallback(() => {
    if (mpHud.transport === "local" && !mpHud.localPaused) mpRef.current?.togglePause();
    setMpMenuOpen(true);
  }, [mpHud.transport, mpHud.localPaused]);

  const mpResume = useCallback(() => {
    setMpMenuOpen(false);
    mpRef.current?.resume();
  }, []);

  /* ---------------- sauvegarde / reprise de partie ---------------- */
  const saveCurrent = useCallback(async () => {
    const g = soloRef.current;
    const snap = g?.saveSnapshot();
    if (!g || !snap) {
      say("Sauvegarde impossible pour le moment");
      return null;
    }
    const where = await prog.saveGame(snap);
    g.confirmSaved();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
    say(where === "cloud" ? "Partie sauvegardée dans le cloud · Vague " + snap.wave : "Partie sauvegardée sur cet appareil · Vague " + snap.wave);
    return where;
  }, [prog.saveGame, say]);

  const saveAndQuit = useCallback(async () => {
    const ok = await saveCurrent();
    if (ok) soloRef.current?.toMenu();
  }, [saveCurrent]);

  const resumeSaved = useCallback(async () => {
    setResumeBusy(true);
    const saved = await prog.loadSavedGame();
    if (!saved) {
      say("Aucune sauvegarde trouvée");
      setResumeBusy(false);
      return;
    }
    if (active !== "solo") {
      setActive("solo");
      await new Promise((r) => window.setTimeout(r, 120));
    }
    const ok = soloRef.current?.loadSaved(saved);
    setResumeBusy(false);
    if (!ok) {
      say("Sauvegarde illisible");
      return;
    }
    setResult(null);
    setRank(null);
    setProgressOpen(false);
    await prog.deleteGame();
    await ensureFullscreen();
  }, [active, prog.loadSavedGame, prog.deleteGame, ensureFullscreen, say]);

  const deleteSave = useCallback(async () => {
    await prog.deleteGame();
    say("Sauvegarde supprimée");
  }, [prog.deleteGame, say]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        if (active === "solo" && (status === "playing" || status === "paused")) void saveCurrent();
        return;
      }
      if (e.code === "KeyM") return toggleMute();
      if (e.code === "KeyV") return toggleVibe();
      if (e.code === "KeyF") return void toggleFullscreen();
      if (progressOpen && e.code === "Escape") return setProgressOpen(false);
      if (active === "solo") {
        const s = soloRef.current?.status;
        if (s === "menu" && (e.code === "Space" || e.code === "Enter")) { e.preventDefault(); void startSolo(); }
        else if (s === "gameover" && (e.code === "KeyR" || e.code === "Space" || e.code === "Enter")) { e.preventDefault(); void startSolo(); }
        else if (s === "paused" && (e.code === "Enter" || e.code === "KeyR")) { e.preventDefault(); void startSolo(); }
      } else if (mpResult && (e.code === "KeyR" || e.code === "Enter")) {
        e.preventDefault();
        if (mpResult.transport === "local") void startLocal(mpResult.mode);
        else if (mpHud.hostId === mpHud.meId) mpRef.current?.requestStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, status, mpResult, mpHud.hostId, mpHud.meId, progressOpen, startSolo, startLocal, toggleMute, toggleVibe, toggleFullscreen, saveCurrent]);

  const handleSave = useCallback((name: string) => {
    if (rank !== null || !result) return;
    const clean = (name || "ACE").trim().slice(0, 16) || "ACE";
    // le nom saisi devient LE nom du joueur : classement local ET profil Supabase
    void prog.rename(clean);
    const out = saveScore({ name: clean, score: result.score, wave: result.wave, kills: result.kills, coverage: result.coverage, date: Date.now() });
    setRows(out.rows);
    setRank(out.rank - 1);
  }, [rank, result, prog.rename]);

  const best = Math.max(bestScore(rows), prog.cloudBest);

  return (
    <div className="relative h-full w-full overflow-hidden bg-court-900">
      <canvas
        ref={canvasRef}
        className={"absolute inset-0 block h-full w-full " + ((active === "solo" && status === "playing") || (active === "mp" && mpHud.phase === "playing") ? "cursor-none" : "cursor-default")}
      />
      <div className="scanlines pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ opacity: active === "solo" && status === "playing" && !isTouch ? 1 : 0 }} />

      {active === "solo" && (
        <>
          {(status === "playing" || status === "paused") && (
            <Hud hud={hud} muted={muted} vibe={vibe} isTouch={isTouch} portrait={portrait}
              onPause={() => soloRef.current?.togglePause()} onMute={toggleMute} onVibe={toggleVibe} onFullscreen={() => void toggleFullscreen()}
              onSave={() => void saveCurrent()} saveBusy={prog.saveBusy} justSaved={justSaved} />
          )}
          {status === "menu" && (
            <StartScreen onStart={() => void startSolo()} onMultiplayer={() => void openMultiplayer()} onProgression={() => setProgressOpen(true)}
              cloudStatus={prog.status} saveMeta={prog.saveMeta} onResume={() => void resumeSaved()} onDeleteSave={() => void deleteSave()} resumeBusy={resumeBusy}
              rows={rows} best={best}
              muted={muted} onMute={toggleMute} isTouch={isTouch} vibe={vibe} onVibe={toggleVibe}
              fullscreen={fullscreen} onFullscreen={() => void toggleFullscreen()} portrait={portrait} />
          )}
          {status === "paused" && (
            <PauseScreen onResume={() => soloRef.current?.resume()} onRestart={() => void startSolo()} onMenu={() => soloRef.current?.toMenu()}
              wave={hud.wave} score={hud.score} isTouch={isTouch} muted={muted} vibe={vibe} onMute={toggleMute} onVibe={toggleVibe}
              onSaveQuit={() => void saveAndQuit()} saveBusy={prog.saveBusy} />
          )}
          {status === "gameover" && result && (
            <GameOverScreen result={result} rows={rows} savedRank={rank} onSave={handleSave} onRestart={() => void startSolo()}
              onMenu={() => soloRef.current?.toMenu()} isTouch={isTouch} muted={muted} onMute={toggleMute}
              cloudStatus={prog.status} onProgression={() => setProgressOpen(true)} />
          )}
        </>
      )}

      {active === "mp" && (
        <Multiplayer
          hud={mpHud}
          result={mpResult}
          error={mpError}
          serverUrl={SERVER_URL}
          initialName={prog.profile?.display_name}
          onNameChange={(n) => void prog.rename(n)}
          muted={muted}
          vibe={vibe}
          isTouch={isTouch}
          menuOpen={mpMenuOpen}
          onMenuOpen={setMpMenuOpen}
          onBack={backToSolo}
          onStartLocal={(m) => void startLocal(m)}
          onCreate={(n, m) => void createRoom(n, m)}
          onJoin={(c, n) => void joinRoom(c, n)}
          onResumeSession={() => mpRef.current?.resumeSession(SERVER_URL)}
          onReady={(r) => mpRef.current?.setReady(r)}
          onStartOnline={() => mpRef.current?.requestStart()}
          onLeave={leaveRoom}
          onPause={mpPause}
          onResume={mpResume}
          onMute={toggleMute}
          onVibe={toggleVibe}
          onFullscreen={() => void toggleFullscreen()}
        />
      )}

      <Progression open={progressOpen} onClose={() => setProgressOpen(false)} prog={prog}
        onResume={() => void resumeSaved()} onDeleteSave={() => void deleteSave()} />

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="panel anim-pop flex items-center gap-2 px-3 py-2">
            <Maximize className="h-4 w-4 shrink-0 text-gold" />
            <p className="font-cond text-[11px] font-extrabold leading-tight tracking-[0.14em] text-chalk">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
