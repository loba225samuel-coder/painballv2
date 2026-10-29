import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Home,
  Trophy,
  Skull,
  Target,
  Zap,
  Keyboard,
  Smartphone,
  VolumeX,
  Volume2,
  Crosshair,
  Sparkles,
  Vibrate,
  Maximize,
  RotateCw,
  Shield,
  Users,
  Cloud,
  CloudOff,
  Save,
  History,
  Trash2,
} from "lucide-react";
import type { RunResult } from "@/game/engine";
import { fmtTime, type ScoreRow } from "@/lib/scores";

/* ---------------- decorative paint splat ---------------- */

export function Splat({ className = "", color = "#ff2f87" }: { className?: string; color?: string }) {
  const nubs = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.22;
        const d = 24 + ((i * 37) % 17);
        return { x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d, r: 5 + ((i * 13) % 9) };
      }),
    []
  );
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g fill={color}>
        <circle cx="50" cy="50" r="30" />
        {nubs.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} />
        ))}
        {nubs.slice(0, 5).map((n, i) => (
          <rect key={"d" + i} x={n.x - 1.6} y={n.y} width="3.2" height={10 + (i % 3) * 8} rx="1.6" />
        ))}
      </g>
    </svg>
  );
}

/* ---------------- shared bits ---------------- */

function Btn({
  children,
  onClick,
  tone = "cyan",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "cyan" | "magenta" | "ghost" | "gold";
  className?: string;
}) {
  const tones: Record<string, string> = {
    cyan: "bg-cyan-hot text-court-900",
    magenta: "bg-magenta-hot text-court-900",
    gold: "bg-gold text-court-900",
    ghost: "bg-court-600 text-chalk border-line!",
  };
  return (
    <button onClick={onClick} className={`btn px-5 py-3 text-sm ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-l-2 border-line pl-2.5">
      <div className="font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">{label}</div>
      <div className="font-display text-lg leading-tight text-chalk">{value}</div>
      {sub && <div className="font-cond text-[10px] tracking-wider text-moss">{sub}</div>}
    </div>
  );
}

export function Leaderboard({ rows, highlight }: { rows: ScoreRow[]; highlight?: number }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h3 className="font-display text-[13px] tracking-wide text-chalk">COURT RECORDS</h3>
        <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">LOCAL TOP 8</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-5 text-moss">
          <Sparkles className="h-4 w-4" />
          <p className="font-cond text-sm font-bold tracking-wide">No runs yet — the court is clean. Paint something.</p>
        </div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="font-cond text-[10px] tracking-[0.18em] text-moss">
              <th className="px-3 py-1 font-extrabold">#</th>
              <th className="py-1 font-extrabold">NAME</th>
              <th className="py-1 text-right font-extrabold">SCORE</th>
              <th className="py-1 text-right font-extrabold">WAVE</th>
              <th className="py-1 pr-3 text-right font-extrabold">PAINT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.date + "-" + i}
                className={
                  "font-cond text-[13px] font-bold " +
                  (highlight === i ? "bg-cyan-hot/15 text-cyan-hot" : i === 0 ? "text-gold" : "text-chalk/85")
                }
              >
                <td className="px-3 py-[3px] font-num">{i + 1}</td>
                <td className="py-[3px] tracking-[0.12em]"><span className="inline-block max-w-[14ch] truncate align-bottom">{r.name}</span></td>
                <td className="py-[3px] text-right font-num">{r.score.toLocaleString()}</td>
                <td className="py-[3px] text-right font-num text-moss">{r.wave}</td>
                <td className="py-[3px] pr-3 text-right font-num text-moss">{Math.round(r.coverage * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MuteBtn({ muted, onMute }: { muted: boolean; onMute: () => void }) {
  return (
    <button
      onClick={onMute}
      aria-label={muted ? "Couper le son" : "Rendre le son"}
      className="panel pointer-events-auto flex h-11 w-11 items-center justify-center text-chalk/70 transition hover:border-cyan-hot hover:text-cyan-hot active:translate-y-0.5"
    >
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}

function Toggle({
  on,
  onClick,
  label,
  icon: Icon,
  tint = "text-lime-hot",
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: typeof VolumeX;
  tint?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`panel pointer-events-auto flex h-11 items-center gap-2 px-3 transition active:translate-y-0.5 ${
        on ? "border-lime-hot/60" : "text-moss"
      }`}
    >
      <Icon className={`h-4 w-4 ${on ? tint : ""}`} />
      <span className={"font-cond text-[11px] font-extrabold tracking-[0.16em] " + (on ? "text-chalk" : "text-moss")}>
        {label}
      </span>
    </button>
  );
}

/** schéma interactif des commandes pouce */
export function ThumbMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={"panel relative overflow-hidden " + (compact ? "p-2.5" : "p-3.5")}>
      <div className="mb-2 flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-lime-hot" />
        <h3 className="font-display text-[12px] tracking-wide text-chalk">DISPOSITION DES POUCE</h3>
        <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">POSER · GLISSER</span>
      </div>
      <svg viewBox="0 0 300 130" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#16231e" />
            <stop offset="1" stopColor="#0b1210" />
          </linearGradient>
        </defs>
        <rect x="4" y="6" width="292" height="118" rx="14" fill="url(#scr)" stroke="#2c4740" strokeWidth="2.5" />
        <line x1="150" y1="14" x2="150" y2="116" stroke="#2c4740" strokeWidth="1.2" strokeDasharray="4 6" />
        {/* stick gauche */}
        <circle cx="62" cy="88" r="30" fill="none" stroke="#3ee8ff" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
        <circle cx="62" cy="88" r="11" fill="#3ee8ff" opacity="0.85">
          <animate attributeName="cx" values="62;80;62;46;62" dur="3.6s" repeatCount="indefinite" />
          <animate attributeName="cy" values="88;74;60;74;88" dur="3.6s" repeatCount="indefinite" />
        </circle>
        <text x="62" y="38" textAnchor="middle" className="font-cond" fill="#8aa99b" fontSize="11" fontWeight="800" letterSpacing="1.6">
          BOUGER
        </text>
        {/* stick droit */}
        <circle cx="206" cy="76" r="26" fill="none" stroke="#ff2f87" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
        <circle cx="206" cy="76" r="9.5" fill="#ff2f87" opacity="0.85">
          <animate attributeName="cx" values="206;226;206;190;206" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="cy" values="76;62;50;66;76" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <text x="206" y="36" textAnchor="middle" fill="#8aa99b" fontSize="11" fontWeight="800" letterSpacing="1.6">
          VISER + TIRER
        </text>
        {/* cluster boutons */}
        <g>
          <circle cx="268" cy="102" r="17" fill="rgba(62,232,255,0.16)" stroke="#3ee8ff" strokeWidth="2" />
          <circle cx="268" cy="102" r="6" fill="none" stroke="#e9f5ee" strokeWidth="2" />
          <circle cx="234" cy="110" r="11.5" fill="rgba(255,216,77,0.14)" stroke="#ffd84d" strokeWidth="2">
            <animate attributeName="r" values="11.5;12.8;11.5" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="258" cy="72" r="9.5" fill="rgba(185,255,51,0.12)" stroke="#b9ff33" strokeWidth="2" />
          <text x="268" y="127" textAnchor="middle" fill="#8aa99b" fontSize="8.5" fontWeight="800" letterSpacing="1">
            FEU
          </text>
          <text x="228" y="127" textAnchor="middle" fill="#8aa99b" fontSize="8.5" fontWeight="800" letterSpacing="1">
            DASH
          </text>
          <text x="284" y="62" textAnchor="middle" fill="#8aa99b" fontSize="8.5" fontWeight="800" letterSpacing="1">
            CHG
          </text>
        </g>
      </svg>
      <p className="mt-2 font-cond text-[11px] font-bold leading-tight tracking-wide text-moss">
        Les pads s'activent sous ton doigt n'importe où : à gauche tu te déplaces, à droite tu vises et tu arroses.
        Le bouton FEU vise tout seul la cible la plus proche.
      </p>
    </div>
  );
}

/** encart à cocher une fois pour toutes : plein écran + secousses */
export function MobileToggles({
  vibe,
  onVibe,
  fullscreen,
  onFullscreen,
}: {
  vibe: boolean;
  onVibe: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle on={fullscreen} onClick={onFullscreen} label="PLEIN ÉCRAN" icon={Maximize} tint="text-gold" />
      <Toggle on={vibe} onClick={onVibe} label="VIBRATION" icon={Vibrate} />
    </div>
  );
}

/* ---------------- start screen ---------------- */

const KEYS: [string, string][] = [
  ["W A S D", "Se déplacer"],
  ["SOURIS", "Viser"],
  ["CLIC G / ESPACE", "Arroser"],
  ["MAJ", "Dash + i-frames"],
  ["R", "Recharger"],
  ["P / ÉCHAP", "Pause"],
];

function ContinueStrip({
  meta,
  onResume,
  onDeleteSave,
  busy,
  compact = false,
}: {
  meta: { wave: number; score: number; savedAt: number; label: string };
  onResume?: () => void;
  onDeleteSave?: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const when = new Date(meta.savedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`panel anim-pop relative flex items-center gap-3 overflow-hidden border-lime-hot/60 ${compact ? "p-2.5" : "p-3"}`}>
      <div className="stripes absolute inset-y-0 left-0 w-1.5 opacity-80" />
      <History className="ml-2 h-5 w-5 shrink-0 text-lime-hot" />
      <div className="min-w-0">
        <div className="font-cond text-[10px] font-extrabold tracking-[0.24em] text-moss">PARTIE EN COURS</div>
        <div className={`font-display leading-none text-chalk ${compact ? "text-base" : "text-xl"}`}>VAGUE {meta.wave}</div>
        <div className="truncate font-cond text-[11px] font-bold tracking-wide text-moss">
          {meta.score.toLocaleString("fr-FR")} pts · {when}
        </div>
      </div>
      <button onClick={onResume} disabled={busy} className={`btn ml-auto flex shrink-0 items-center gap-2 bg-lime-hot text-court-900 disabled:opacity-50 ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`}>
        <Play className="h-4 w-4 fill-current" /> {busy ? "…" : "REPRENDRE"}
      </button>
      {onDeleteSave && (
        <button onClick={onDeleteSave} aria-label="Supprimer la sauvegarde" title="Supprimer la sauvegarde" className="panel flex h-9 w-9 shrink-0 items-center justify-center text-moss transition hover:border-magenta-hot hover:text-magenta-hot">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1
      className={
        "relative font-display leading-[0.82] text-chalk " + (small ? "text-[13vw] sm:text-7xl lg:text-8xl" : "text-[15vw] sm:text-7xl lg:text-8xl")
      }
    >
      <span className="block" style={{ textShadow: "0 6px 0 #05100d, 0 0 42px rgba(62,232,255,0.35)" }}>
        PAINT<span className="text-cyan-hot">BALL</span>
      </span>
      <span className="block pl-[0.12em] text-[0.62em]" style={{ textShadow: "0 5px 0 #05100d, 0 0 30px rgba(255,47,135,0.4)" }}>
        <span className="text-magenta-hot">2</span>D
        <span className="ml-3 align-middle font-cond text-[22%] font-extrabold tracking-[0.3em] text-moss">
          SPLAT ARENA
        </span>
      </span>
    </h1>
  );
}

function Tips({ rows }: { rows: { icon: typeof Target; t: string; d: string }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map(({ icon: Icon, t, d }, i) => (
        <div key={t} className="flex items-start gap-2.5 border-l-2 border-cyan-hot/70 py-1.5 pl-2.5" style={{ borderTopWidth: i ? 0 : 0 }}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-hot" />
          <div>
            <div className="font-display text-[11px] leading-tight text-chalk">{t}</div>
            <div className="mt-0.5 font-cond text-[11px] font-semibold leading-tight tracking-wide text-moss">{d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileStart({
  onStart,
  onMultiplayer,
  onProgression,
  cloudStatus,
  saveMeta,
  onResume,
  onDeleteSave,
  resumeBusy,
  rows,
  best,
  muted,
  onMute,
  vibe,
  onVibe,
  fullscreen,
  onFullscreen,
  portrait,
}: StartProps) {
  const [seen, setSeen] = useState(() => localStorage.getItem("pb.rotate") === "1");
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="stripes h-2 w-full opacity-70" />
      <div className="noise relative flex min-h-[calc(100%-8px)] flex-col gap-4 px-4 py-5">
        <div className="pt-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="slash bg-magenta-hot px-2 py-[3px] font-display text-[10px] text-court-900">ARCADE</span>
            <span className="font-cond text-[10px] font-extrabold tracking-[0.26em] text-moss">
              60 FPS · TOP-DOWN · SPLAT OR BE SPLATTED
            </span>
          </div>
          <div className="relative">
            <Splat className="anim-wobble absolute -left-4 -top-6 h-24 w-24 opacity-60" color="#3ee8ff" />
            <Splat className="absolute -right-2 bottom-1 h-16 w-16 opacity-45" color="#b9ff33" />
            <Logo small />
          </div>
          <p className="mt-3 max-w-md font-body text-[15px] leading-snug text-chalk/75">
            Cinq adversaires, zéro pitié. Chaque bille manquée tache le terrain — et le terrain vaut des points.
          </p>
        </div>

        {!seen && portrait && (
          <button
            onClick={() => {
              localStorage.setItem("pb.rotate", "1");
              setSeen(true);
            }}
            className="panel anim-pop flex w-full items-center gap-3 border-gold/60 px-3 py-2.5 text-left active:translate-y-0.5"
          >
            <RotateCw className="h-6 w-6 shrink-0 anim-spin-slow text-gold" />
            <span>
              <span className="block font-display text-[12px] text-gold">TOURNE TON TÉLÉPHONE</span>
              <span className="block font-cond text-[11px] font-bold tracking-wide text-moss">
                EN PAYSAGE TU VOIS BEAUCOUP PLUS DE TERRAIN · TAPE POUR NE PLUS VOIR ÇA
              </span>
            </span>
          </button>
        )}

        {/* zone pouce : action principale en bas */}
        <div className="mt-auto flex flex-col gap-3">
          {saveMeta && onResume && <ContinueStrip meta={saveMeta} onResume={onResume} onDeleteSave={onDeleteSave} busy={resumeBusy} compact />}
          <div className="flex flex-wrap items-center gap-2">
            <MobileToggles vibe={vibe} onVibe={onVibe} fullscreen={fullscreen} onFullscreen={onFullscreen} />
            <MuteBtn muted={muted} onMute={onMute} />
            {onProgression && (
              <button onClick={onProgression} className="panel pointer-events-auto flex h-11 items-center gap-2 px-3 active:translate-y-0.5">
                {cloudStatus === "guest" || cloudStatus === "account" ? <Cloud className="h-4 w-4 text-lime-hot" /> : <CloudOff className="h-4 w-4 text-gold" />}
                <span className="font-cond text-[11px] font-extrabold tracking-[0.16em] text-chalk">PROGRESSION</span>
              </button>
            )}
            {best > 0 && (
              <span className="ml-auto flex items-center gap-1.5 font-cond text-[11px] font-extrabold tracking-[0.2em] text-gold">
                <Trophy className="h-4 w-4" /> {best.toLocaleString()}
              </span>
            )}
          </div>
          <button onClick={onStart} className="btn flex w-full items-center justify-center gap-3 bg-cyan-hot py-4 text-lg text-court-900">
            <Play className="h-6 w-6 fill-current" />
            SOLO
          </button>
          {onMultiplayer && (
            <button
              disabled
              title="Le mode multijoueur arrive bientot"
              className="btn flex w-full cursor-not-allowed items-center justify-center gap-3 border-line bg-court-600/70 py-3.5 text-base text-moss opacity-80"
            >
              <Users className="h-5 w-5" />
              MULTIJOUEUR
              <span className="slash bg-gold px-2 py-[2px] font-display text-[10px] text-court-900">BIENTÔT</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <ThumbMap compact />
            <div className="panel p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Target className="h-4 w-4 text-lime-hot" />
                <h3 className="font-display text-[12px] tracking-wide text-chalk">À RETENIR</h3>
              </div>
              <Tips
                rows={[
                  { icon: Zap, t: "COMBO x6", d: "un splat tous les 3,4 s" },
                  { icon: Crosshair, t: "PEINS TOUT", d: "couverture = bonus de fin de vague" },
                  { icon: Sparkles, t: "BOSSE x5", d: "tous les 5 niveaux, gros butin" },
                  { icon: Shield, t: "DASH = I-FRAMES", d: "traverse la peinture" },
                ]}
              />
            </div>
          </div>
          <Leaderboard rows={rows} />
        </div>
      </div>
    </div>
  );
}

function DesktopStart({ onStart, onMultiplayer, onProgression, cloudStatus, saveMeta, onResume, onDeleteSave, resumeBusy, rows, best, muted, onMute }: StartProps) {
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="stripes h-2 w-full opacity-70" />
      <div className="noise relative min-h-[calc(100%-8px)] bg-gradient-to-br from-court-900/95 via-court-900/80 to-court-900/40">
        <div className="pad-menu-t pad-menu-b mx-auto grid max-w-6xl items-center gap-6 p-4 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="anim-in">
            <div className="mb-3 flex items-center gap-2">
              <span className="slash bg-magenta-hot px-2 py-[3px] font-display text-[10px] text-court-900">ARCADE ARENA</span>
              <span className="font-cond text-[11px] font-extrabold tracking-[0.32em] text-moss">
                60 FPS · TOP-DOWN · SPLAT OR BE SPLATTED
              </span>
            </div>
            <div className="relative">
              <Splat className="anim-wobble absolute -left-6 -top-8 h-32 w-32 opacity-70 sm:h-44 sm:w-44" color="#3ee8ff" />
              <Splat className="absolute -right-3 bottom-0 h-20 w-20 opacity-50 sm:h-28 sm:w-28" color="#b9ff33" />
              <Logo />
            </div>
            <p className="mt-4 max-w-md font-body text-[15px] leading-snug text-chalk/75">
              Ton marqueur crache de la peinture néon. Chaque tir manqué tache le court, et le court rapporte :
              enchaîne les splats pour le multiplicateur, dash dans les tirs, tiens le plus de vagues possible.
            </p>

            {saveMeta && onResume && (
              <div className="mt-4 max-w-lg">
                <ContinueStrip meta={saveMeta} onResume={onResume} onDeleteSave={onDeleteSave} busy={resumeBusy} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Btn onClick={onStart} tone="cyan" className="text-base">
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" /> SOLO
                </span>
              </Btn>
              {onMultiplayer && (
                <button
                  disabled
                  title="Le mode multijoueur arrive bientot"
                  className="btn flex cursor-not-allowed items-center gap-2 border-line bg-court-600/70 px-5 py-3 text-base text-moss opacity-80"
                >
                  <Users className="h-4 w-4" /> MULTIJOUEUR
                  <span className="slash bg-gold px-2 py-[2px] font-display text-[10px] text-court-900">BIENTÔT</span>
                </button>
              )}
              <span className="flex items-center gap-2 font-cond text-[11px] font-extrabold tracking-[0.2em] text-moss">
                <kbd className="panel px-2 py-1 text-cyan-hot">ESPACE</kbd> POUR LANCER
              </span>
              {best > 0 && (
                <span className="flex items-center gap-1.5 font-cond text-[11px] font-extrabold tracking-[0.2em] text-gold">
                  <Trophy className="h-3.5 w-3.5" /> RECORD {best.toLocaleString()}
                </span>
              )}
              <MuteBtn muted={muted} onMute={onMute} />
              {onProgression && (
                <button onClick={onProgression} className="panel pointer-events-auto flex h-11 items-center gap-2 px-3 transition hover:border-cyan-hot active:translate-y-0.5">
                  {cloudStatus === "guest" || cloudStatus === "account" ? <Cloud className="h-4 w-4 text-lime-hot" /> : <CloudOff className="h-4 w-4 text-gold" />}
                  <span className="font-cond text-[11px] font-extrabold tracking-[0.18em] text-chalk">PROGRESSION</span>
                </button>
              )}
            </div>

            <div className="mt-5 grid max-w-lg gap-2 sm:grid-cols-3">
              <Tips
                rows={[
                  { icon: Target, t: "PEINS LE COURT", d: "la couverture verse un bonus à la fin de chaque vague." },
                  { icon: Zap, t: "COMBO", d: "garde la chaîne d'éliminations sous 3,4 s." },
                  { icon: Crosshair, t: "BONUS RAMASSABLES", d: "bouclier, ricochet, bille explosive, rouleau, overclock, triple jet." },
                ]}
              />
            </div>
          </div>

          <div className="anim-in flex flex-col gap-4" style={{ animationDelay: "0.08s" }}>
            <div className="panel">
              <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
                <Keyboard className="h-4 w-4 text-lime-hot" />
                <h3 className="font-display text-[13px] tracking-wide text-chalk">COMMANDES</h3>
                <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">CLAVIER + SOURIS</span>
              </div>
              <ul className="divide-y divide-line/60">
                {KEYS.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="font-cond text-[11px] font-extrabold tracking-[0.16em] text-moss">{v.toUpperCase()}</span>
                    <kbd className="panel px-2 py-0.5 font-cond text-[11px] font-extrabold tracking-wider text-cyan-hot">{k}</kbd>
                  </li>
                ))}
              </ul>
              <p className="border-t-2 border-line px-3 py-1.5 font-cond text-[10px] font-bold tracking-wider text-moss">
                SUR MOBILE : GLISSE À GAUCHE POUR BOUGER, À DROITE POUR VISER ET TIRER.
              </p>
            </div>
            <Leaderboard rows={rows} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StartProps {
  onStart: () => void;
  onMultiplayer?: () => void;
  onProgression?: () => void;
  cloudStatus?: string;
  saveMeta?: { wave: number; score: number; savedAt: number; label: string } | null;
  onResume?: () => void;
  onDeleteSave?: () => void;
  resumeBusy?: boolean;
  rows: ScoreRow[];
  best: number;
  muted: boolean;
  onMute: () => void;
  isTouch: boolean;
  vibe: boolean;
  onVibe: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  portrait: boolean;
}

export function StartScreen(props: StartProps) {
  return props.isTouch ? <MobileStart {...props} /> : <DesktopStart {...props} />;
}

/* ---------------- pause ---------------- */

export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
  wave,
  score,
  isTouch,
  muted,
  vibe,
  onMute,
  onVibe,
  onSaveQuit,
  saveBusy,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  wave: number;
  score: number;
  isTouch: boolean;
  muted: boolean;
  vibe: boolean;
  onMute: () => void;
  onVibe: () => void;
  onSaveQuit?: () => void;
  saveBusy?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-court-900/72 px-3 backdrop-blur-[3px]">
      <div className={"panel anim-pop w-full " + (isTouch ? "max-w-[430px]" : "max-w-[420px]")}>
        <div className="stripes h-1.5 w-full opacity-80" />
        <div className={isTouch ? "p-4" : "p-5"}>
          <div className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-cyan-hot" />
            <h2 className="font-display text-2xl text-chalk">PAUSE</h2>
            <span className="ml-auto font-cond text-[11px] font-extrabold tracking-[0.2em] text-moss">
              VAGUE {wave}
            </span>
          </div>
          <p className="mt-1 font-cond text-[12px] font-bold tracking-[0.16em] text-moss">
            {score.toLocaleString()} POINTS SUR LE TABLEAU · LES ADVERSAIRES T'ATTENDENT
          </p>
          <div className={"mt-4 flex flex-col gap-2 " + (isTouch ? "gap-2.5" : "")}>
            <button onClick={onResume} className="btn flex w-full items-center justify-center gap-2 bg-cyan-hot py-3.5 text-base text-court-900">
              <Play className="h-5 w-5 fill-current" /> REPRENDRE
            </button>
            {onSaveQuit && (
              <button onClick={onSaveQuit} disabled={saveBusy} className="btn flex w-full items-center justify-center gap-2 bg-gold py-3 text-sm text-court-900 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saveBusy ? "SAUVEGARDE…" : "SAUVEGARDER ET QUITTER"}
              </button>
            )}
            <div className="flex gap-2">
              <button onClick={onRestart} className="btn flex flex-1 items-center justify-center gap-2 bg-magenta-hot py-3 text-sm text-court-900">
                <RotateCcw className="h-4 w-4" /> REPRENDRE À ZÉRO
              </button>
              <button onClick={onMenu} className="btn flex flex-1 items-center justify-center gap-2 bg-court-600 py-3 text-sm text-chalk">
                <Home className="h-4 w-4" /> QUITTER
              </button>
            </div>
          </div>
          {isTouch ? (
            <div className="mt-3 flex items-center gap-2">
              <MuteBtn muted={muted} onMute={onMute} />
              <Toggle on={vibe} onClick={onVibe} label="VIBRATION" icon={Vibrate} />
            </div>
          ) : (
            <p className="mt-3 text-center font-cond text-[10px] font-bold tracking-[0.2em] text-moss">
              <span className="text-cyan-hot">P</span> OU <span className="text-cyan-hot">ÉCHAP</span> POUR REPRENDRE ·{" "}
              <span className="text-cyan-hot">R</span> POUR REPARTIR DE ZÉRO
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- game over ---------------- */

/** Nom de joueur : lettres (accents compris), chiffres, espace, - _ . — 16 caractères. */
const cleanName = (v: string) =>
  v
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 16);

export function GameOverScreen({
  result,
  rows,
  savedRank,
  onSave,
  onRestart,
  onMenu,
  isTouch,
  muted,
  onMute,
  cloudStatus,
  onProgression,
}: {
  result: RunResult;
  rows: ScoreRow[];
  savedRank: number | null;
  onSave: (name: string) => void;
  onRestart: () => void;
  onMenu: () => void;
  isTouch: boolean;
  muted: boolean;
  onMute: () => void;
  cloudStatus?: string;
  onProgression?: () => void;
}) {
  const [name, setName] = useState(() => (localStorage.getItem("pb.name") || "").slice(0, 16));
  const inputRef = useRef<HTMLInputElement>(null);
  const acc = result.shots > 0 ? Math.round((result.hits / result.shots) * 100) : 0;
  const isRecord = rows.length === 0 || result.score >= rows[0].score;

  useEffect(() => {
    if (!isTouch) inputRef.current?.focus();
  }, [isTouch]);

  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto bg-court-900/78 backdrop-blur-[2px]">
      <div className="pad-menu-t pad-menu-b mx-auto grid min-h-full max-w-5xl items-center gap-5 p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel anim-pop relative overflow-hidden">
          <div className="stripes h-1.5 w-full" />
          <Splat className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 opacity-25" color="#ff2f87" />
          <div className="relative p-5">
            <div className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-magenta-hot" />
              <h2 className="font-display text-2xl leading-none text-magenta-hot sm:text-3xl">YOU'RE SPLATTED</h2>
              {isRecord && <span className="slash anim-blink bg-gold px-2 py-[2px] font-display text-[10px] text-court-900">NEW RECORD</span>}
            </div>
            <div className="mt-3 flex items-end gap-3">
              <div>
                <div className="font-cond text-[10px] font-extrabold tracking-[0.28em] text-moss">FINAL SCORE</div>
                <div
                  className="font-display text-5xl leading-none text-chalk sm:text-6xl"
                  style={{ textShadow: "0 4px 0 #05100d, 0 0 34px rgba(62,232,255,0.4)" }}
                >
                  {result.score.toLocaleString()}
                </div>
              </div>
            </div>
            {onProgression && (
              <button onClick={onProgression} className="panel mt-3 flex w-full items-center gap-2 px-3 py-2 text-left transition hover:border-cyan-hot active:translate-y-0.5">
                {cloudStatus === "guest" || cloudStatus === "account" ? (
                  <Cloud className="h-4 w-4 shrink-0 text-lime-hot" />
                ) : (
                  <CloudOff className="h-4 w-4 shrink-0 text-gold" />
                )}
                <span className="font-cond text-[11px] font-extrabold tracking-[0.16em] text-chalk">
                  {cloudStatus === "guest" || cloudStatus === "account"
                    ? "PARTIE ENVOYÉE AU CLOUD · VOIR MA PROGRESSION"
                    : "SAUVEGARDE LOCALE · ACTIVER LE CLOUD"}
                </span>
              </button>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="WAVE" value={String(result.wave)} />
              <Stat label="SPLATS" value={String(result.kills)} />
              <Stat label="KILL CHAIN" value={String(result.maxCombo)} sub="best streak" />
              <Stat label="ACCURACY" value={acc + "%"} sub={`${result.hits}/${result.shots}`} />
              <Stat label="COURT PAINT" value={Math.round(result.coverage * 100) + "%"} />
              <Stat label="TIME" value={fmtTime(result.time)} />
            </div>

            <div className={"mt-5 flex flex-wrap items-center gap-2 " + (isTouch ? "flex-nowrap" : "")}>
              {isTouch ? (
                <>
                  <button
                    onClick={onRestart}
                    className="btn flex flex-1 items-center justify-center gap-2 bg-cyan-hot py-4 text-base text-court-900"
                  >
                    <RotateCcw className="h-5 w-5" /> REJOUER
                  </button>
                  <button
                    onClick={onMenu}
                    aria-label="Menu"
                    className="btn flex items-center justify-center bg-court-600 px-4 py-4 text-sm text-chalk"
                  >
                    <Home className="h-5 w-5" />
                  </button>
                  <MuteBtn muted={muted} onMute={onMute} />
                </>
              ) : (
                <>
                  <Btn onClick={onRestart} tone="cyan">
                    <span className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" /> REJOUER (R)
                    </span>
                  </Btn>
                  <Btn onClick={onMenu} tone="ghost">
                    <span className="flex items-center gap-2">
                      <Home className="h-4 w-4" /> MENU
                    </span>
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="anim-in flex flex-col gap-4" style={{ animationDelay: "0.06s" }}>
          <div className="panel p-4">
            <h3 className="font-display text-[13px] tracking-wide text-chalk">ENREGISTRER TA PARTIE</h3>
            <p className="mt-1 font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
              TON NOM SERA COLLÉ À TON SCORE, À TON CLASSEMENT ET À TA PROGRESSION.
            </p>
            <label
              htmlFor="run-name"
              className="mt-3 block font-cond text-[10px] font-extrabold tracking-[0.22em] text-moss"
            >
              TON NOM
            </label>
            <input
              id="run-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(cleanName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onSave(name.trim());
              }}
              placeholder="SAMUEL"
              maxLength={16}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              inputMode="text"
              aria-label="Ton nom, 16 caracteres maximum"
              className="mt-1 w-full border-2 border-line bg-court-700 px-3 py-2.5 font-display text-lg tracking-[0.12em] text-cyan-hot outline-none transition placeholder:text-moss/50 focus:border-cyan-hot focus:shadow-[0_0_0_3px_rgba(62,232,255,0.16)]"
            />
            <div className="mt-2 flex items-center gap-3">
              <span className="font-num font-cond text-[11px] font-extrabold tracking-[0.16em] text-moss">
                {name.trim().length}/16
              </span>
              <Btn
                onClick={() => onSave(name.trim() || "ACE")}
                tone={savedRank === null ? "gold" : "ghost"}
                className="flex-1"
              >
                <span className="flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" /> {savedRank === null ? "ENREGISTRER LE SCORE" : "SCORE ENREGISTRÉ"}
                </span>
              </Btn>
            </div>
            {savedRank !== null ? (
              <p className="mt-2 font-cond text-[11px] font-extrabold tracking-[0.18em] text-lime-hot">
                {savedRank < 0
                  ? "PARTIE ENREGISTRÉE — HORS DU TOP 8"
                  : savedRank === 0
                    ? "EN TÊTE DU TABLEAU — RANG #1"
                    : `ENREGISTRÉ — RANG #${savedRank + 1}`}
              </p>
            ) : (
              <p className="mt-2 font-cond text-[11px] font-bold leading-snug tracking-[0.14em] text-moss">
                1 À 16 CARACTÈRES · ENTRÉE POUR VALIDER · MÉMORISÉ SUR CET APPAREIL
              </p>
            )}
          </div>
          <Leaderboard rows={rows} />
        </div>
      </div>
    </div>
  );
}
