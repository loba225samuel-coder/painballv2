import type { HudState } from "@/game/engine";
import {
  Timer,
  Users,
  VolumeX,
  Volume2,
  Pause,
  PaintBucket,
  Vibrate,
  Maximize,
  Smartphone,
  Save,
  Check,
  Loader2,
  Shield,
  CornerUpRight,
  Bomb,
  PaintRoller,
  Zap,
  Crosshair,
  FastForward,
  Snowflake,
} from "lucide-react";

const POWER_ICONS: Record<string, typeof Shield> = {
  rapid: Zap,
  triple: Crosshair,
  shield: Shield,
  ricochet: CornerUpRight,
  explosive: Bomb,
  roller: PaintRoller,
  dash: FastForward,
  comboFreeze: Snowflake,
};

interface Props {
  hud: HudState;
  muted: boolean;
  vibe: boolean;
  isTouch: boolean;
  portrait: boolean;
  onPause: () => void;
  onMute: () => void;
  onVibe: () => void;
  onFullscreen: () => void;
  onSave: () => void;
  saveBusy?: boolean;
  justSaved?: boolean;
}

const tap =
  "panel flex items-center justify-center transition active:translate-y-0.5 hover:border-cyan-hot/70";

export default function Hud({
  hud,
  muted,
  vibe,
  isTouch,
  portrait,
  onPause,
  onMute,
  onVibe,
  onFullscreen,
  onSave,
  saveBusy,
  justSaved,
}: Props) {
  const hearts = Array.from({ length: hud.maxHp });
  const cov = Math.round(hud.coverage * 100);
  // A short landscape viewport has little vertical room; keep only gameplay-critical actions visible.
  const viewportHeight = typeof window !== "undefined" ? (window.visualViewport?.height ?? window.innerHeight) : 0;
  const compactLandscape = isTouch && !portrait && viewportHeight < 560;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* ---------- barre haute ---------- */}
      <div className={"pad-hud-t pad-hud-l pad-hud-r flex items-start justify-between " + (compactLandscape ? "gap-1" : "gap-2 sm:gap-4")}>
        <div className={"flex min-w-0 flex-col " + (compactLandscape ? "gap-1" : "gap-1.5")}>
          <div className={"flex items-center " + (compactLandscape ? "gap-1" : "gap-1.5")}>
            <div className={"panel flex items-center " + (compactLandscape ? "gap-1 px-1.5 py-1" : "gap-2 px-2.5 py-1.5")}>
              <PaintBucket className={"shrink-0 text-cyan-hot " + (compactLandscape ? "h-3.5 w-3.5" : isTouch ? "h-5 w-5" : "h-4 w-4")} />
              <div className="flex gap-1">
                {hearts.map((_, i) => {
                  const full = i < hud.hp;
                  return (
                    <span
                      key={i}
                      className={
                        "skew-x-[-12deg] border transition-all duration-150 " +
                        (compactLandscape ? "h-3.5 w-2 " : isTouch ? "h-5 w-2.5 " : "h-4 w-2.5 ") +
                        (full
                          ? "border-cyan-hot/60 bg-cyan-hot shadow-[0_0_10px_rgba(62,232,255,0.55)]"
                          : "border-line bg-court-600/70")
                      }
                    />
                  );
                })}
              </div>
            </div>
            {isTouch && (
              <div className={"panel flex items-center " + (compactLandscape ? "gap-1 px-1.5 py-1" : "gap-1.5 px-2 py-1.5")}>
                <Users className={compactLandscape ? "h-3.5 w-3.5 text-magenta-hot" : "h-4 w-4 text-magenta-hot"} />
                <span className={"font-num font-extrabold leading-none text-chalk " + (compactLandscape ? "text-xs" : "text-base")}>{hud.enemies}</span>
              </div>
            )}
          </div>

          <div className={"flex flex-wrap items-center " + (compactLandscape ? "gap-1" : "gap-1.5")}>
            <div className={"slash bg-lime-hot " + (compactLandscape ? "px-2 py-0.5" : "px-2.5 " + (isTouch ? "py-1" : "py-0.5"))}>
              <span className={"font-display tracking-wide text-court-900 " + (compactLandscape ? "text-[11px]" : isTouch ? "text-[15px]" : "text-[13px]")}>
                VAGUE {hud.wave || 1}
              </span>
            </div>
            {!isTouch && (
              <div className="panel flex items-center gap-1.5 px-2.5 py-1.5">
                <Users className="h-4 w-4 text-magenta-hot" />
                <span className="font-cond text-sm font-extrabold tracking-wider text-chalk/80">
                  RESTANTS <span className="font-num text-base text-chalk">{hud.enemies}</span>
                </span>
              </div>
            )}
            <div className={"panel flex items-center " + (compactLandscape ? "gap-1 px-1.5 py-0.5" : "gap-1.5 px-2 py-1")}>
              <span className={"relative block overflow-hidden rounded-sm bg-court-600 " + (compactLandscape ? "h-1 w-10" : "h-1.5 w-14 sm:w-24")}>
                <span
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-hot to-lime-hot transition-[width] duration-200"
                  style={{ width: `${Math.min(100, cov)}%` }}
                />
              </span>
              <span className={"font-num font-extrabold leading-none text-chalk/80 " + (compactLandscape ? "text-[9px]" : "text-[11px]")}>{cov}%</span>
            </div>
            {!isTouch && (
              <div className="panel hidden items-center gap-1 px-2 py-1 sm:flex">
                <Timer className="h-3.5 w-3.5 text-moss" />
                <span className="font-num text-xs text-moss">
                  {Math.floor(hud.time / 60)}:{String(Math.floor(hud.time % 60)).padStart(2, "0")}
                </span>
              </div>
            )}
            {hud.powers.slice(0, 6).map((pw) => {
              const Icon = POWER_ICONS[pw.id] ?? Zap;
              return (
                <div key={pw.id} className={"panel anim-pop flex items-center " + (compactLandscape ? "gap-0.5 px-1 py-0.5" : "gap-1 px-2 py-0.5")} style={{ borderColor: pw.color + "99" }} title={pw.name}>
                  <Icon className={compactLandscape ? "h-3 w-3" : "h-3.5 w-3.5"} style={{ color: pw.color }} />
                  {!compactLandscape && <span className="font-cond text-[10px] font-extrabold tracking-widest" style={{ color: pw.color }}>
                    {pw.name}{pw.charges ? ` ×${pw.charges}` : ""}
                  </span>}
                  {compactLandscape && typeof pw.charges === "number" && pw.charges > 0 && <span className="font-num text-[8px] font-extrabold" style={{ color: pw.color }}>×{pw.charges}</span>}
                  <span className={"relative block overflow-hidden rounded-full bg-court-600 " + (compactLandscape ? "h-0.5 w-3" : "h-1 w-7")}>
                    <span className="absolute inset-y-0 left-0 transition-[width] duration-75" style={{ width: `${Math.max(0, Math.min(1, pw.pct)) * 100}%`, background: pw.color }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* score + boutons système */}
        <div className={"flex items-start " + (compactLandscape ? "flex-col items-end gap-0.5" : "gap-1.5 sm:gap-2")}>
          <div className={"text-right " + (portrait ? "max-w-[38vw]" : "")}>
            <div className={"font-cond font-extrabold tracking-[0.2em] text-moss " + (compactLandscape ? "text-[8px]" : "text-[10px] tracking-[0.28em]")}>SCORE</div>
            <div
              className={
                "font-display leading-none text-chalk tabular-nums " +
                (compactLandscape ? "text-[18px] " : isTouch ? "text-[26px] " : "text-2xl sm:text-4xl ")
              }
              style={{ textShadow: "0 3px 0 rgba(5,16,13,0.9), 0 0 24px rgba(62,232,255,0.35)" }}
            >
              {hud.score.toLocaleString()}
            </div>
            {hud.combo > 1 && (
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span className="slash bg-magenta-hot px-2 py-[2px] font-display text-[12px] text-court-900">
                  COMBO x{hud.combo}
                </span>
                <span className="relative block h-1.5 w-12 overflow-hidden rounded-full bg-court-700 sm:w-16">
                  <span
                    className="absolute inset-y-0 left-0 bg-magenta-hot transition-[width] duration-75"
                    style={{ width: `${hud.comboPct * 100}%` }}
                  />
                </span>
              </div>
            )}
          </div>
          <div className={"pointer-events-auto " + (compactLandscape ? "flex items-center gap-1" : "flex flex-col gap-1.5")}>
            <button
              onClick={onSave}
              disabled={saveBusy}
              title="Sauvegarder la partie (Ctrl+S)"
              aria-label="Sauvegarder la partie"
              className={tap + (compactLandscape ? " compact-touch-button h-9 w-9" : isTouch ? " h-11 w-11" : " h-9 gap-1 px-2") + (justSaved ? " border-lime-hot/80" : "")}
            >
              {saveBusy ? (
                <Loader2 className={compactLandscape ? "h-3.5 w-3.5 animate-spin text-cyan-hot" : "h-4 w-4 animate-spin text-cyan-hot"} />
              ) : justSaved ? (
                <Check className={compactLandscape ? "h-3.5 w-3.5 text-lime-hot" : "h-4 w-4 text-lime-hot"} />
              ) : (
                <Save className={compactLandscape ? "h-3.5 w-3.5 text-gold" : "h-4 w-4 text-gold"} />
              )}
              {!isTouch && <span className="font-cond text-[10px] font-extrabold tracking-[0.16em] text-chalk/85">{justSaved ? "OK" : "SAUVER"}</span>}
            </button>
            <button onClick={onPause} aria-label="Pause" className={tap + (compactLandscape ? " compact-touch-button h-9 w-9" : isTouch ? " h-12 w-12" : " h-9 w-9")}>
              <Pause className={compactLandscape ? "h-3.5 w-3.5 text-chalk" : isTouch ? "h-5 w-5 text-chalk" : "h-4 w-4 text-chalk/80"} />
            </button>
            {!compactLandscape && <button onClick={onMute} aria-label="Son" className={tap + (isTouch ? " h-12 w-12" : " h-9 w-9")}>
              {muted ? (
                <VolumeX className={isTouch ? "h-5 w-5 text-magenta-hot" : "h-4 w-4 text-chalk/80"} />
              ) : (
                <Volume2 className={isTouch ? "h-5 w-5 text-cyan-hot" : "h-4 w-4 text-chalk/80"} />
              )}
            </button>}
            {isTouch && !compactLandscape && (
              <button onClick={onVibe} aria-label="Vibration" className={tap + " h-12 w-12"}>
                <Vibrate className={"h-5 w-5 " + (vibe ? "text-lime-hot" : "text-moss")} />
              </button>
            )}
            {isTouch && !compactLandscape && !portrait && (
              <button onClick={onFullscreen} aria-label="Plein écran" className={tap + " h-12 w-12"}>
                <Maximize className="h-5 w-5 text-gold" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- barre basse : uniquement au clavier (les pouces en ont besoin) ---------- */}
      {!isTouch && (
        <div className="pad-hud-b pad-hud-l pad-hud-r absolute inset-x-0 bottom-0 flex items-end justify-between gap-3">
          <div className="flex items-center gap-1.5 opacity-75">
            {[
              ["WASD", "BOUGER"],
              ["SOURIS", "VISER"],
              ["CLIC / ESPACE", "TIRER"],
              ["MAJ", "DASH"],
              ["R", "CHARGER"],
              ["P", "PAUSE"],
            ].map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <kbd className="panel px-1.5 py-0.5 font-cond text-[10px] font-extrabold tracking-wider text-cyan-hot">{k}</kbd>
                <span className="font-cond text-[10px] font-extrabold tracking-[0.16em] text-moss">{v}</span>
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1 font-cond text-[10px] font-extrabold tracking-[0.18em] text-moss">
            <Smartphone className="h-3 w-3" /> SUR MOBILE : GLISSE À DROITE POUR VISER
          </span>
        </div>
      )}
    </div>
  );
}
