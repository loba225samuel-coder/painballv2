import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Flame,
  Gamepad2,
  Home,
  Keyboard,
  Link,
  Loader2,
  Maximize,
  PaintBucket,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Smartphone,
  Swords,
  Timer,
  Trophy,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  CornerUpRight,
  Bomb,
  PaintRoller,
  Zap,
  Crosshair,
  Rocket,
  CircleDotDashed,
  Snowflake,
  Magnet,
} from "lucide-react";

const POWER_ICONS: Record<string, typeof Shield> = {
  rapid: Zap,
  triple: Crosshair,
  shield: Shield,
  ricochet: CornerUpRight,
  explosive: Bomb,
  roller: PaintRoller,
  turbo: Rocket,
  cluster: CircleDotDashed,
  ink: Snowflake,
  magnet: Magnet,
  slow: Snowflake,
};
const POWER_SHORT: Record<string, string> = {
  rapid: "OVR",
  triple: "TRI",
  shield: "BOU",
  ricochet: "RIC",
  explosive: "EXP",
  roller: "ROU",
  turbo: "TUR",
  cluster: "GRA",
  ink: "ENC",
  magnet: "AIM",
  slow: "RAL",
};
import type { MpHud, MpHudPlayer, MpResult } from "@/game/multiplayer";
import type { MpMode } from "@/game/mpSim";
import { Splat } from "./Screens";

interface Props {
  hud: MpHud;
  result: MpResult | null;
  error: string | null;
  serverUrl: string;
  initialName?: string;
  onNameChange?: (name: string) => void;
  muted: boolean;
  vibe: boolean;
  isTouch: boolean;
  menuOpen: boolean;
  onMenuOpen: (v: boolean) => void;
  onBack: () => void;
  onStartLocal: (mode: MpMode) => void;
  onCreate: (name: string, mode: MpMode) => void;
  onJoin: (code: string, name: string) => void;
  onResumeSession: () => void;
  onReady: (ready: boolean) => void;
  onStartOnline: () => void;
  onLeave: () => void;
  onPause: () => void;
  onResume: () => void;
  onMute: () => void;
  onVibe: () => void;
  onFullscreen: () => void;
}

const btn = "btn flex items-center justify-center gap-2 px-4 py-3 text-sm";
const panelBtn = "panel flex h-11 w-11 items-center justify-center text-chalk/80 transition active:translate-y-0.5 hover:border-cyan-hot/70";

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  title: string;
  desc: string;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`panel relative overflow-hidden p-4 text-left transition active:translate-y-0.5 ${active ? "border-cyan-hot" : "opacity-80 hover:opacity-100"}`}
    >
      <div className={`mb-2 inline-flex h-10 w-10 items-center justify-center border-2 border-court-900 ${tone}`}>
        <Icon className="h-5 w-5 text-court-900" />
      </div>
      <div className="font-display text-base text-chalk">{title}</div>
      <p className="mt-1 font-cond text-[12px] font-bold leading-tight tracking-wide text-moss">{desc}</p>
      {active && <span className="absolute right-3 top-3 font-cond text-[10px] font-extrabold tracking-[0.2em] text-cyan-hot">CHOISI</span>}
    </button>
  );
}

function PlayerCard({ p, versus, compact = false }: { p: MpHudPlayer; versus: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <div className="panel flex min-w-0 items-center gap-1.5 px-2 py-1" style={{ borderColor: p.isMe ? p.color : undefined }}>
        <span className="h-2.5 w-2.5 shrink-0 skew-x-[-12deg]" style={{ background: p.color }} />
        <span className="truncate font-display text-[10px] text-chalk">{p.name}</span>
        <span className="flex shrink-0 gap-[2px]">
          {Array.from({ length: p.maxHp }).map((_, i) => (
            <span key={i} className="h-2.5 w-1 skew-x-[-12deg]" style={{ background: i < p.hp ? p.color : "#16231e" }} />
          ))}
        </span>
        <span className="ml-auto font-num text-[11px] font-extrabold text-chalk">{(versus ? p.finalScore : p.score).toLocaleString()}</span>
        {p.down && <span className="font-cond text-[9px] font-extrabold tracking-widest text-magenta-hot">À TERRE</span>}
        {!p.connected && <WifiOff className="h-3 w-3 shrink-0 text-magenta-hot" />}
        {p.powers.slice(0, 2).map((pw) => {
          const Icon = POWER_ICONS[pw.id] ?? Zap;
          return (
            <span key={pw.id} className="flex shrink-0 items-center gap-[2px]" style={{ color: pw.color }} title={pw.name}>
              <Icon className="h-3 w-3" />
              <span className="font-cond text-[8px] font-extrabold tracking-wider">{POWER_SHORT[pw.id] ?? pw.name.slice(0, 3)}{pw.charges ? `×${pw.charges}` : ""}</span>
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`panel min-w-0 px-3 py-2 ${p.isMe ? "border-cyan-hot/60" : ""}`} style={{ borderColor: p.isMe ? p.color : undefined }}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 skew-x-[-12deg]" style={{ background: p.color }} />
        <span className="truncate font-display text-[12px] text-chalk">{p.name}</span>
        {p.isMe && <span className="font-cond text-[9px] font-extrabold tracking-[0.2em] text-moss">TOI</span>}
        {!p.connected && <WifiOff className="ml-auto h-3.5 w-3.5 text-magenta-hot" />}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {Array.from({ length: p.maxHp }).map((_, i) => (
          <span key={i} className="h-3.5 w-2 skew-x-[-12deg] border" style={{ background: i < p.hp ? p.color : "transparent", borderColor: i < p.hp ? p.color : "#2c4740" }} />
        ))}
        <span className="ml-auto font-num text-[11px] font-extrabold text-chalk/80">{p.ammo}/{p.mag}</span>
      </div>
      <div className="mt-1 flex items-center justify-between font-cond text-[11px] font-extrabold tracking-wider text-moss">
        <span>{versus ? `${Math.round(p.coverage * 100)}% TERR.` : `${p.kills} SPLATS`}</span>
        <span className="font-num text-chalk">{(versus ? p.finalScore : p.score).toLocaleString()}</span>
      </div>
      {p.down && <div className="mt-1 font-cond text-[10px] font-extrabold tracking-[0.18em] text-magenta-hot">{p.revive > 0 ? "RÉANIMATION…" : "À TERRE"}</div>}
      {p.powers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {p.powers.slice(0, 6).map((pw) => {
            const Icon = POWER_ICONS[pw.id] ?? Zap;
            return (
              <span key={pw.id} className="flex items-center gap-1 border px-1 py-[1px]" style={{ borderColor: pw.color + "88", color: pw.color }} title={pw.name}>
                <Icon className="h-3 w-3" />
                <span className="font-cond text-[9px] font-extrabold tracking-widest">{pw.name}{pw.charges ? ` ×${pw.charges}` : ""}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControlHelp({ isTouch, gamepads }: { isTouch: boolean; gamepads: number }) {
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-lime-hot" />
        <h3 className="font-display text-[12px] text-chalk">COMMENT JOUER À DEUX</h3>
        <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">
          {gamepads > 0 ? `${gamepads} MANETTE${gamepads > 1 ? "S" : ""}` : "CLAVIER / TACTILE"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border-l-2 border-cyan-hot pl-2.5">
          <div className="font-display text-[11px] text-cyan-hot">JOUEUR 1</div>
          <p className="font-cond text-[11px] font-bold leading-tight tracking-wide text-moss">
            {isTouch ? "Tactile : gauche bouge, droite vise, boutons FEU/DASH." : "WASD + souris · Espace tirer · Maj dash · R charger"}
          </p>
        </div>
        <div className="border-l-2 border-lime-hot pl-2.5">
          <div className="font-display text-[11px] text-lime-hot">JOUEUR 2</div>
          <p className="font-cond text-[11px] font-bold leading-tight tracking-wide text-moss">
            {gamepads > 0 ? "Manette : stick gauche bouge, stick droit vise, A tirer, B dash, X charger." : "Flèches bouger · IJKL viser · Entrée tirer · Maj droit dash · Retour charger"}
          </p>
        </div>
      </div>
      {isTouch && <p className="mt-2 font-cond text-[10px] font-bold tracking-wider text-gold">SUR MOBILE : LE DUO LOCAL DEMANDE UNE MANETTE POUR LE JOUEUR 2. SINON, PASSEZ EN LIGNE.</p>}
    </div>
  );
}

export default function Multiplayer(props: Props) {
  const { hud, result, error, serverUrl, isTouch } = props;
  const [mode, setMode] = useState<MpMode>("coop");
  const [name, setName] = useState(() => localStorage.getItem("pb.name") || "");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!sessionStorage.getItem("pb.mp.session"));
  }, [hud.connection, hud.code]);

  useEffect(() => {
    if (props.initialName) setName(props.initialName);
  }, [props.initialName]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const room = q.get("room");
    if (room) setCode(room.toUpperCase().slice(0, 6));
  }, []);

  const versus = hud.mode === "versus";
  const inGame = hud.phase === "countdown" || hud.phase === "playing" || hud.phase === "ended";
  const lobby = hud.phase === "lobby" && hud.players.length > 0;
  const select = !inGame && !lobby && hud.connection !== "connecting" && hud.connection !== "reconnecting";
  const me = hud.players.find((p) => p.isMe);
  const host = hud.hostId === hud.meId;
  const canStart = hud.players.length === 2 && hud.players.every((p) => p.ready && p.connected);
  const onlineReady = !!serverUrl;

  const invite = useMemo(() => {
    if (!hud.code) return "";
    const u = new URL(window.location.href);
    u.searchParams.set("room", hud.code);
    u.searchParams.set("mode", "multi");
    return u.toString();
  }, [hud.code]);

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? hud.code : invite;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      window.prompt("Copie :", text);
    }
  };

  const saveName = (v: string) => {
    const clean = v.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 12);
    setName(clean);
    localStorage.setItem("pb.name", clean);
    props.onNameChange?.(clean);
  };

  return (
    <div className="absolute inset-0">
      {/* ---------- HUD en jeu ---------- */}
      {inGame && (
        <div className="pointer-events-none absolute inset-0 select-none">
          <div className="pad-hud-t pad-hud-l pad-hud-r flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="panel flex items-center gap-2 px-3 py-1.5">
                {versus ? <Swords className="h-4 w-4 text-magenta-hot" /> : <Users className="h-4 w-4 text-cyan-hot" />}
                <span className="font-display text-[13px] text-chalk">{versus ? "VERSUS" : "COOP"}</span>
                {!versus && <span className="slash bg-lime-hot px-2 py-[2px] font-display text-[11px] text-court-900">VAGUE {hud.wave || 1}</span>}
                {versus && (
                  <span className="flex items-center gap-1 font-num text-sm font-extrabold text-gold">
                    <Timer className="h-3.5 w-3.5" /> {Math.ceil(hud.timeLeft)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="panel px-2.5 py-1">
                  <span className="font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">{versus ? "TERRITOIRE" : "SCORE ÉQUIPE"}</span>
                  <div className="font-display text-xl leading-none text-chalk">
                    {versus ? `${Math.round(hud.coverage * 100)}%` : hud.teamScore.toLocaleString()}
                  </div>
                </div>
                {hud.combo > 1 && !versus && (
                  <div className="panel anim-pop border-magenta-hot/60 px-2 py-1">
                    <span className="flex items-center gap-1 font-display text-[12px] text-magenta-hot"><Flame className="h-3.5 w-3.5" /> x{hud.combo}</span>
                    <span className="mt-1 block h-1 w-14 overflow-hidden rounded-full bg-court-600">
                      <span className="block h-full bg-magenta-hot" style={{ width: `${hud.comboPct * 100}%` }} />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              {hud.transport === "online" && (
                <div className="panel hidden px-2.5 py-1.5 sm:block">
                  <div className="flex items-center gap-1.5 font-cond text-[10px] font-extrabold tracking-[0.18em] text-moss">
                    {hud.connection === "online" ? <Wifi className="h-3.5 w-3.5 text-lime-hot" /> : <WifiOff className="h-3.5 w-3.5 text-magenta-hot" />}
                    {hud.code} · {hud.ping} MS
                  </div>
                </div>
              )}
              <div className="pointer-events-auto flex gap-1.5">
                <button onClick={props.onPause} aria-label="Menu" className={panelBtn}><Pause className="h-4 w-4" /></button>
                <button onClick={props.onMute} aria-label="Son" className={panelBtn}>{props.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                {isTouch && <button onClick={props.onVibe} aria-label="Vibration" className={panelBtn}><Vibrate className={"h-4 w-4 " + (props.vibe ? "text-lime-hot" : "text-moss")} /></button>}
              </div>
            </div>
          </div>

          <div
            className={
              isTouch
                ? "pad-hud-l pad-hud-r absolute inset-x-0 flex items-start justify-between gap-2"
                : "pad-hud-b pad-hud-l pad-hud-r absolute inset-x-0 bottom-0 flex items-end justify-between gap-2"
            }
            style={isTouch ? { top: "calc(72px + var(--sa-t))" } : undefined}
          >
            {hud.players[0] && <div className="w-[min(44vw,220px)]"><PlayerCard p={hud.players[0]} versus={versus} compact={isTouch} /></div>}
            {!isTouch && (
              <div className="hidden items-center gap-2 font-cond text-[10px] font-extrabold tracking-[0.18em] text-moss md:flex">
                <Keyboard className="h-3.5 w-3.5" /> P1 WASD/SOURIS · P2 FLÈCHES/IJKL · MANETTES OK
              </div>
            )}
            {hud.players[1] && <div className="w-[min(44vw,220px)]"><PlayerCard p={hud.players[1]} versus={versus} compact={isTouch} /></div>}
          </div>
        </div>
      )}

      {/* ---------- Sélection ---------- */}
      {select && (
        <div className="scroll-thin absolute inset-0 overflow-y-auto bg-court-900/82 backdrop-blur-[2px]">
          <div className="stripes h-2 w-full opacity-70" />
          <div className="pad-menu-t pad-menu-b mx-auto grid max-w-6xl gap-5 p-4 sm:p-7 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="anim-in">
              <button onClick={props.onBack} className="mb-3 flex items-center gap-2 font-cond text-[11px] font-extrabold tracking-[0.2em] text-moss transition hover:text-cyan-hot">
                <ArrowLeft className="h-4 w-4" /> RETOUR AU SOLO
              </button>
              <div className="relative">
                <Splat className="anim-wobble absolute -left-5 -top-7 h-28 w-28 opacity-60" color="#b9ff33" />
                <h1 className="relative font-display text-[12vw] leading-[0.85] text-chalk sm:text-6xl lg:text-7xl" style={{ textShadow: "0 6px 0 #05100d" }}>
                  MULTI<span className="text-cyan-hot">JOUEUR</span>
                </h1>
              </div>
              <p className="mt-3 max-w-md font-body text-[15px] leading-snug text-chalk/75">
                Le même court, deux marqueurs. En coop, vous tenez les vagues ensemble et vous vous relevez.
                En versus, vous peignez le territoire pendant 90 secondes.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ModeCard active={mode === "coop"} onClick={() => setMode("coop")} icon={Users} title="COOP · 2 JOUEURS" desc="Vagues partagées, pas de tir allié, réanimation du coéquipier." tone="bg-cyan-hot" />
                <ModeCard active={mode === "versus"} onClick={() => setMode("versus")} icon={Swords} title="VERSUS · 1 CONTRE 1" desc="90 s, réapparition rapide, le territoire peint fait la différence." tone="bg-magenta-hot" />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button onClick={() => props.onStartLocal(mode)} className={`${btn} bg-cyan-hot text-court-900`}>
                  <Gamepad2 className="h-4 w-4" /> DUO LOCAL · MÊME ÉCRAN
                </button>
                {hasSession && onlineReady && (
                  <button onClick={props.onResumeSession} className={`${btn} bg-court-600 text-chalk`}>
                    <RotateCcw className="h-4 w-4" /> REPRENDRE LE SALON
                  </button>
                )}
              </div>
              <div className="mt-4">
                <ControlHelp isTouch={isTouch} gamepads={hud.gamepads} />
              </div>
            </div>

            <div className="anim-in flex flex-col gap-4" style={{ animationDelay: "0.07s" }}>
              <div className="panel p-4">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-lime-hot" />
                  <h3 className="font-display text-[13px] text-chalk">SALON PRIVÉ EN LIGNE</h3>
                  <span className={`ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] ${onlineReady ? "text-lime-hot" : "text-gold"}`}>
                    {onlineReady ? "SERVEUR PRÊT" : "À CONFIGURER"}
                  </span>
                </div>
                {!onlineReady && (
                  <p className="mt-2 border-l-2 border-gold pl-2 font-cond text-[11px] font-bold leading-tight tracking-wide text-moss">
                    Le duo local marche tout de suite. Pour l’en ligne, lancez <span className="text-chalk">npx tsx server/index.ts</span> puis
                    renseignez <span className="text-chalk">VITE_MULTIPLAYER_URL</span> (voir README).
                  </p>
                )}
                <label className="mt-3 block font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">TON NOM</label>
                <input
                  value={name}
                  onChange={(e) => saveName(e.target.value)}
                  placeholder="JOUEUR 1"
                  maxLength={12}
                  className="mt-1 w-full border-2 border-line bg-court-700 px-3 py-2 font-display text-sm tracking-wider text-chalk outline-none focus:border-cyan-hot"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button disabled={!onlineReady} onClick={() => props.onCreate(name || "JOUEUR 1", mode)} className={`${btn} bg-lime-hot text-court-900 disabled:opacity-40`}>
                    <Play className="h-4 w-4 fill-current" /> CRÉER
                  </button>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                      placeholder="CODE"
                      className="w-full border-2 border-line bg-court-700 px-2 py-2 text-center font-display text-sm tracking-[0.25em] text-cyan-hot outline-none focus:border-cyan-hot"
                    />
                    <button disabled={!onlineReady || code.length < 4} onClick={() => props.onJoin(code, name || "JOUEUR 2")} className={`${btn} bg-court-600 px-3 text-chalk disabled:opacity-40`}>
                      OK
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-hot" />
                  <h3 className="font-display text-[13px] text-chalk">RÈGLES RAPIDES</h3>
                </div>
                <ul className="mt-2 space-y-1.5 font-cond text-[12px] font-bold tracking-wide text-moss">
                  <li className="flex gap-2"><PaintBucket className="h-4 w-4 shrink-0 text-cyan-hot" /> Chaque bille manquée peint le court. En versus, repeindre une case la vole.</li>
                  <li className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-lime-hot" /> En coop, reste près d’un coéquipier à terre 1,5 s pour le relever.</li>
                  <li className="flex gap-2"><PaintBucket className="h-4 w-4 shrink-0 text-lime-hot" /> 11 bonus : bouclier, ricochet, explosif, rouleau, turbo, grappe, encre, aimant, triple, overclock, soin.</li>
                  <li className="flex gap-2"><Trophy className="h-4 w-4 shrink-0 text-gold" /> Le serveur valide tirs, dégâts et scores : pas de triche par le navigateur.</li>
                  <li className="flex gap-2"><Smartphone className="h-4 w-4 shrink-0 text-magenta-hot" /> En ligne mobile : un appareil par joueur, plein écran conseillé.</li>
                </ul>
              </div>
              {error && <div className="panel border-magenta-hot/70 p-3 font-cond text-[12px] font-extrabold tracking-wide text-magenta-hot">{error}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Connexion ---------- */}
      {(hud.connection === "connecting" || hud.connection === "reconnecting") && !inGame && (
        <div className="absolute inset-0 flex items-center justify-center bg-court-900/80">
          <div className="panel anim-pop flex items-center gap-3 px-5 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-hot" />
            <span className="font-display text-sm text-chalk">{hud.connection === "connecting" ? "CONNEXION AU SALON…" : "RECONNEXION…"}</span>
          </div>
        </div>
      )}

      {/* ---------- Salon ---------- */}
      {lobby && (
        <div className="scroll-thin absolute inset-0 overflow-y-auto bg-court-900/78 backdrop-blur-[2px]">
          <div className="pad-menu-t pad-menu-b mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 p-4">
            <div className="panel anim-pop relative overflow-hidden p-5">
              <Splat className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 opacity-20" color={versus ? "#ff2f87" : "#3ee8ff"} />
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="font-cond text-[10px] font-extrabold tracking-[0.28em] text-moss">CODE DU SALON</div>
                  <div className="font-display text-5xl tracking-[0.18em] text-cyan-hot" style={{ textShadow: "0 4px 0 #05100d" }}>{hud.code}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => copy("code")} className={panelBtn} aria-label="Copier le code">{copied === "code" ? <Check className="h-4 w-4 text-lime-hot" /> : <Copy className="h-4 w-4" />}</button>
                  <button onClick={() => copy("link")} className={panelBtn} aria-label="Copier le lien">{copied === "link" ? <Check className="h-4 w-4 text-lime-hot" /> : <Link className="h-4 w-4" />}</button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[0, 1].map((slot) => {
                  const p = hud.players.find((x) => x.slot === slot);
                  return (
                    <div key={slot} className={`border-2 p-3 ${p ? "border-line bg-court-700/60" : "border-dashed border-line/70"}`}>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 skew-x-[-12deg]" style={{ background: p?.color ?? "#2c4740" }} />
                        <span className="font-display text-[13px] text-chalk">{p ? p.name : "EN ATTENTE…"}</span>
                        {p && hud.hostId === p.id && <Crown className="h-4 w-4 text-gold" />}
                        {p?.isMe && <span className="ml-auto font-cond text-[9px] font-extrabold tracking-[0.2em] text-moss">TOI</span>}
                      </div>
                      <div className="mt-2 font-cond text-[11px] font-extrabold tracking-[0.18em]">
                        {p ? (
                          p.ready ? <span className="text-lime-hot">PRÊT</span> : <span className="text-gold">PAS PRÊT</span>
                        ) : (
                          <span className="text-moss">PARTAGEZ LE CODE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={() => props.onReady(!me?.ready)} className={`${btn} ${me?.ready ? "bg-court-600 text-chalk" : "bg-lime-hot text-court-900"}`}>
                  <Check className="h-4 w-4" /> {me?.ready ? "PLUS PRÊT" : "JE SUIS PRÊT"}
                </button>
                {host && (
                  <button disabled={!canStart} onClick={props.onStartOnline} className={`${btn} bg-cyan-hot text-court-900 disabled:opacity-40`}>
                    <Play className="h-4 w-4 fill-current" /> LANCER {versus ? "LE DUEL" : "LA COOP"}
                  </button>
                )}
                {!host && <span className="font-cond text-[11px] font-extrabold tracking-[0.18em] text-moss">L’HÔTE LANCE LA PARTIE</span>}
                <button onClick={props.onLeave} className={`${btn} ml-auto bg-court-600 text-chalk`}><Home className="h-4 w-4" /> QUITTER</button>
              </div>
              {error && <p className="mt-3 font-cond text-[12px] font-extrabold tracking-wide text-magenta-hot">{error}</p>}
            </div>
            <ControlHelp isTouch={isTouch} gamepads={hud.gamepads} />
          </div>
        </div>
      )}

      {/* ---------- Menu pause / salon en jeu ---------- */}
      {(props.menuOpen || hud.localPaused) && inGame && !result && (
        <div className="absolute inset-0 flex items-center justify-center bg-court-900/72 px-3 backdrop-blur-[3px]">
          <div className="panel anim-pop w-full max-w-[420px] p-5">
            <div className="stripes -mx-5 -mt-5 mb-4 h-1.5 opacity-80" />
            <h2 className="font-display text-2xl text-chalk">{hud.transport === "local" ? "PAUSE" : "SALON " + hud.code}</h2>
            <p className="mt-1 font-cond text-[12px] font-bold tracking-[0.16em] text-moss">
              {hud.transport === "local" ? "LA PARTIE LOCALE EST EN PAUSE" : "LA PARTIE EN LIGNE CONTINUE PENDANT LE MENU"}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={() => { props.onMenuOpen(false); props.onResume(); }} className={`${btn} bg-cyan-hot text-court-900`}><Play className="h-4 w-4 fill-current" /> REPRENDRE</button>
              {hud.transport === "local" && (
                <button onClick={() => { props.onMenuOpen(false); props.onStartLocal(hud.mode); }} className={`${btn} bg-magenta-hot text-court-900`}><RotateCcw className="h-4 w-4" /> RECOMMENCER</button>
              )}
              <button onClick={props.onLeave} className={`${btn} bg-court-600 text-chalk`}><Home className="h-4 w-4" /> QUITTER LE SALON</button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={props.onMute} className={panelBtn}>{props.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
              <button onClick={props.onVibe} className={panelBtn}><Vibrate className={"h-4 w-4 " + (props.vibe ? "text-lime-hot" : "text-moss")} /></button>
              <button onClick={props.onFullscreen} className={panelBtn}><Maximize className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Résultats ---------- */}
      {result && (
        <div className="scroll-thin absolute inset-0 overflow-y-auto bg-court-900/80 backdrop-blur-[2px]">
          <div className="pad-menu-t pad-menu-b mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 p-4">
            <div className="panel anim-pop relative overflow-hidden p-5">
              <Splat className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 opacity-25" color={result.winnerId ? result.players.find((p) => p.id === result.winnerId)?.color ?? "#ffd84d" : "#ff2f87"} />
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-gold" />
                <h2 className="font-display text-2xl text-chalk sm:text-3xl">
                  {result.mode === "versus"
                    ? result.winnerId
                      ? `${result.players.find((p) => p.id === result.winnerId)?.name ?? "JOUEUR"} GAGNE`
                      : "ÉGALITÉ"
                    : "ÉQUIPE SPLATTÉE"}
                </h2>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {result.players.map((p) => (
                  <div key={p.id} className={`border-2 p-3 ${p.id === result.winnerId ? "border-gold" : "border-line"}`} style={{ borderColor: p.id === result.winnerId ? "#ffd84d" : undefined }}>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 skew-x-[-12deg]" style={{ background: p.color }} />
                      <span className="font-display text-[13px] text-chalk">{p.name}</span>
                      {p.id === result.winnerId && <Crown className="ml-auto h-4 w-4 text-gold" />}
                    </div>
                    <div className="mt-2 font-display text-3xl text-chalk">{p.finalScore.toLocaleString()}</div>
                    <div className="mt-1 grid grid-cols-3 gap-1 font-cond text-[11px] font-extrabold tracking-wider text-moss">
                      <span>{p.kills} SPLATS</span>
                      <span>{p.deaths} MORTS</span>
                      <span>{Math.round(p.coverage * 100)}% PEINT</span>
                    </div>
                  </div>
                ))}
              </div>
              {result.mode === "coop" && (
                <p className="mt-3 font-cond text-[12px] font-extrabold tracking-[0.18em] text-moss">
                  VAGUE {result.wave} · SCORE ÉQUIPE {result.teamScore.toLocaleString()} · COURT {Math.round(result.coverage * 100)}%
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {(result.transport === "local" || host) ? (
                  <button onClick={() => (result.transport === "local" ? props.onStartLocal(result.mode) : props.onStartOnline())} className={`${btn} bg-cyan-hot text-court-900`}>
                    <RotateCcw className="h-4 w-4" /> REVANCHE
                  </button>
                ) : (
                  <span className="flex items-center gap-2 font-cond text-[11px] font-extrabold tracking-[0.18em] text-moss"><Loader2 className="h-4 w-4 animate-spin" /> L’HÔTE PEUT RELANCER</span>
                )}
                <button onClick={props.onLeave} className={`${btn} bg-court-600 text-chalk`}><Home className="h-4 w-4" /> QUITTER</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
