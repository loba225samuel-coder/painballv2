import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  Crosshair,
  Flame,
  Gamepad2,
  History,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  Swords,
  Target,
  Timer,
  Trophy,
  User,
  Users,
  X,
  Play,
  Trash2,
} from "lucide-react";
import type { GameMode, ProgressionApi } from "@/hooks/useProgression";
import { Splat } from "./Screens";

const COLORS = ["#3ee8ff", "#b9ff33", "#ff2f87", "#ffd84d", "#a86bff", "#ff8a1e"];
const MODES: { id: GameMode; label: string; icon: typeof User }[] = [
  { id: "solo", label: "SOLO", icon: User },
  { id: "coop", label: "COOP", icon: Users },
  { id: "versus", label: "VERSUS", icon: Swords },
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}
function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stat({ icon: Icon, label, value, big = false }: { icon: typeof User; label: string; value: string; big?: boolean }) {
  return (
    <div className={`border-l-2 border-line pl-2.5 ${big ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`font-display leading-tight text-chalk ${big ? "text-3xl" : "text-lg"}`}>{value}</div>
    </div>
  );
}

export default function Progression({ open, onClose, prog, onResume, onDeleteSave }: { open: boolean; onClose: () => void; prog: ProgressionApi; onResume?: () => void; onDeleteSave?: () => void }) {
  const [tab, setTab] = useState<GameMode>("solo");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) void prog.loadLeaderboard(tab);
  }, [open, tab, prog.loadLeaderboard]);

  useEffect(() => {
    setName(prog.displayName);
  }, [prog.displayName, open]);

  if (!open) return null;

  const signed = prog.status === "guest" || prog.status === "account";
  const stats = prog.stats;
  const accuracy = stats && stats.total_shots > 0 ? Math.round((stats.total_hits / stats.total_shots) * 100) : 0;
  const leaders = prog.leaders[tab] ?? [];

  return (
    <div className="scroll-thin absolute inset-0 z-40 overflow-y-auto bg-court-900/86 backdrop-blur-[3px]">
      <div className="pad-menu-t pad-menu-b mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div>
            <div className="font-cond text-[10px] font-extrabold tracking-[0.3em] text-moss">SAUVEGARDE & PROGRESSION</div>
            <h2 className="font-display text-3xl leading-none text-chalk sm:text-4xl" style={{ textShadow: "0 4px 0 #05100d" }}>
              VESTIAIRE
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="panel ml-auto flex h-11 w-11 items-center justify-center text-chalk/80 transition hover:border-magenta-hot hover:text-magenta-hot">
            <X className="h-5 w-5" />
          </button>
        </div>

        {prog.error && (
          <div className="panel anim-pop mb-4 flex items-start gap-3 border-gold/70 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="font-cond text-[12px] font-extrabold leading-snug tracking-wide text-chalk">{prog.error}</p>
            <button onClick={prog.clearError} className="ml-auto font-cond text-[11px] font-extrabold tracking-widest text-moss hover:text-chalk">
                  OK
                </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {/* ---------- identité / compte ---------- */}
          <div className="panel anim-in relative overflow-hidden p-5">
            <Splat className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 opacity-20" color={prog.profile?.paint_color ?? "#3ee8ff"} />
            <div className="relative">
              <div className="flex items-center gap-2">
                {signed ? <Cloud className="h-4 w-4 text-lime-hot" /> : <CloudOff className="h-4 w-4 text-gold" />}
                <span className="font-cond text-[11px] font-extrabold tracking-[0.22em] text-moss">
                  {prog.status === "loading" && "CHARGEMENT…"}
                  {prog.status === "local" && "SAUVEGARDE LOCALE"}
                  {prog.status === "guest" && "CLOUD · INVITÉ"}
                  {prog.status === "account" && "CLOUD · COMPTE"}
                  {prog.status === "error" && "HORS LIGNE / ERREUR"}
                </span>
                {prog.saving && <Loader2 className="ml-auto h-4 w-4 animate-spin text-cyan-hot" />}
                {!prog.saving && prog.lastSync && signed && (
                  <span className="ml-auto flex items-center gap-1 font-cond text-[10px] font-extrabold tracking-widest text-lime-hot">
                    <Check className="h-3.5 w-3.5" /> SYNC
                  </span>
                )}
              </div>

              <label className="mt-4 block font-cond text-[10px] font-extrabold tracking-[0.22em] text-moss">PSEUDO</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 16))}
                onBlur={() => void prog.rename(name)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                maxLength={16}
                placeholder="JOUEUR"
                aria-label="Pseudo du joueur"
                className="mt-1 w-full border-2 border-line bg-court-700 px-3 py-2 font-display text-lg tracking-wider text-chalk outline-none focus:border-cyan-hot"
              />
              <div className="mt-1 flex items-center justify-between font-cond text-[10px] font-bold tracking-[0.14em] text-moss">
                <span>Nom complet, pas seulement 3 lettres</span>
                <span className="font-num">{name.length}/16</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="font-cond text-[10px] font-extrabold tracking-[0.22em] text-moss">PEINTURE</span>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => void prog.setColor(c)}
                    aria-label={`Couleur ${c}`}
                    className={`h-7 w-7 skew-x-[-12deg] border-2 transition ${prog.profile?.paint_color === c ? "border-chalk scale-110" : "border-court-900"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-end justify-between gap-3 border-y-2 border-line py-4">
                <div>
                  <div className="font-cond text-[10px] font-extrabold tracking-[0.28em] text-moss">GRADE</div>
                  <div className="font-display text-3xl leading-none text-gold" style={{ textShadow: "0 3px 0 #05100d" }}>{prog.grade}</div>
                </div>
                <div className="text-right">
                  <div className="font-cond text-[10px] font-extrabold tracking-[0.28em] text-moss">RECORD</div>
                  <div className="font-display text-3xl leading-none text-chalk">{(stats?.best_score ?? 0).toLocaleString()}</div>
                </div>
              </div>

              {prog.saveMeta && (
                <div className="mt-4 border-2 border-lime-hot/60 bg-court-700/60 p-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-lime-hot" />
                    <span className="font-cond text-[10px] font-extrabold tracking-[0.24em] text-moss">PARTIE EN COURS</span>
                    <span className="ml-auto font-display text-sm text-chalk">VAGUE {prog.saveMeta.wave}</span>
                  </div>
                  <p className="mt-1 font-cond text-[11px] font-bold tracking-wide text-moss">{prog.saveMeta.label}</p>
                  <div className="mt-2 flex gap-2">
                    {onResume && (
                      <button onClick={onResume} className="btn flex flex-1 items-center justify-center gap-2 bg-lime-hot py-2 text-xs text-court-900">
                        <Play className="h-3.5 w-3.5 fill-current" /> REPRENDRE
                      </button>
                    )}
                    {onDeleteSave && (
                      <button onClick={onDeleteSave} aria-label="Supprimer la sauvegarde" className="panel flex h-9 w-9 items-center justify-center text-moss hover:border-magenta-hot hover:text-magenta-hot">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!signed ? (
                <div className="mt-4">
                  <p className="font-cond text-[12px] font-bold leading-snug tracking-wide text-moss">
                    Active la sauvegarde cloud pour garder tes stats, ton historique et ton classement d’un appareil à l’autre.
                    Sans compte, tout reste dans ce navigateur.
                  </p>
                  <button onClick={() => void prog.enableGuest()} disabled={prog.busy} className="btn mt-3 flex w-full items-center justify-center gap-2 bg-cyan-hot py-3 text-sm text-court-900 disabled:opacity-50">
                    {prog.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                    CONTINUER EN INVITÉ
                  </button>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-px flex-1 bg-line" />
                    <span className="font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">OU COMPTE EMAIL</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  {prog.magicSent ? (
                    <p className="mt-3 flex items-center gap-2 font-cond text-[12px] font-extrabold tracking-wide text-lime-hot">
                      <Check className="h-4 w-4" /> Lien envoyé. Ouvre-le sur cet appareil pour te connecter.
                    </p>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="toi@exemple.com"
                        className="w-full border-2 border-line bg-court-700 px-3 py-2 font-body text-sm text-chalk outline-none focus:border-cyan-hot"
                      />
                      <button onClick={() => void prog.sendMagicLink(email)} disabled={prog.busy} className="btn flex items-center gap-2 bg-court-600 px-3 py-2 text-xs text-chalk disabled:opacity-50">
                        <Mail className="h-4 w-4" /> LIEN
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-cond text-[10px] font-extrabold tracking-[0.22em] text-moss">COMPTE</div>
                    <div className="truncate font-body text-sm text-chalk">
                      {prog.session?.user.email ?? (prog.status === "guest" ? "Invité · lié à ce navigateur" : "Connecté")}
                    </div>
                  </div>
                  <button onClick={() => void prog.refresh()} className="panel flex h-10 items-center gap-2 px-3 font-cond text-[11px] font-extrabold tracking-widest text-chalk/80 hover:border-cyan-hot">
                    <RefreshCw className="h-4 w-4" /> RAFRAÎCHIR
                  </button>
                  <button onClick={() => void prog.signOut()} className="panel flex h-10 items-center gap-2 px-3 font-cond text-[11px] font-extrabold tracking-widest text-magenta-hot">
                    <LogOut className="h-4 w-4" /> DÉCONNEXION
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ---------- stats / historique / classement ---------- */}
          <div className="flex flex-col gap-4">
            <div className="panel anim-in p-4" style={{ animationDelay: "0.05s" }}>
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-hot" />
                <h3 className="font-display text-[13px] text-chalk">CARRIÈRE</h3>
                <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">
                  {stats?.games_played ?? 0} PARTIE{(stats?.games_played ?? 0) > 1 ? "S" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Trophy} label="SCORE CUMULÉ" value={(stats?.total_score ?? 0).toLocaleString()} big />
                <Stat icon={Flame} label="MEILLEURE VAGUE" value={String(stats?.best_wave ?? 0)} />
                <Stat icon={Target} label="SPLATS" value={String(stats?.total_kills ?? 0)} />
                <Stat icon={Crosshair} label="PRÉCISION" value={accuracy + "%"} />
                <Stat icon={Gamepad2} label="COUVERTURE MAX" value={Math.round((stats?.best_coverage ?? 0) * 100) + "%"} />
                <Stat icon={Swords} label="VICTOIRES VERSUS" value={`${stats?.versus_wins ?? 0}/${stats?.versus_games ?? 0}`} />
                <Stat icon={Timer} label="TEMPS DE JEU" value={fmtTime(stats?.total_time ?? 0)} />
              </div>
            </div>

            <div className="panel anim-in p-4" style={{ animationDelay: "0.1s" }}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <h3 className="font-display text-[13px] text-chalk">CLASSEMENT CLOUD</h3>
                <div className="ml-auto flex gap-1">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setTab(m.id)}
                      className={`flex items-center gap-1 px-2 py-1 font-cond text-[10px] font-extrabold tracking-widest transition ${tab === m.id ? "bg-cyan-hot text-court-900" : "bg-court-600 text-moss hover:text-chalk"}`}
                    >
                      <m.icon className="h-3 w-3" /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {leaders.length === 0 ? (
                <p className="font-cond text-[12px] font-bold tracking-wide text-moss">
                  {signed ? "Aucune partie classée pour ce mode. À toi d’ouvrir le bal." : "Connecte-toi pour enregistrer tes parties ici."}
                </p>
              ) : (
                <ol className="space-y-1">
                  {leaders.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 border-b border-line/50 py-1 last:border-0">
                      <span className="w-5 font-num text-[12px] font-extrabold text-moss">{i + 1}</span>
                      <span className="h-3 w-3 skew-x-[-12deg]" style={{ background: l.paint_color }} />
                      <span className="truncate font-display text-[12px] text-chalk">{l.display_name}</span>
                      <span className="font-cond text-[10px] font-extrabold tracking-widest text-gold">{l.grade}</span>
                      <span className="ml-auto font-num text-[13px] font-extrabold text-chalk">{l.score.toLocaleString()}</span>
                      <span className="w-10 text-right font-cond text-[10px] font-bold text-moss">V{l.wave}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="panel anim-in p-4" style={{ animationDelay: "0.15s" }}>
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-lime-hot" />
                <h3 className="font-display text-[13px] text-chalk">DERNIÈRES PARTIES</h3>
              </div>
              {prog.runs.length === 0 ? (
                <p className="font-cond text-[12px] font-bold tracking-wide text-moss">L’historique se remplit dès la première partie sauvegardée.</p>
              ) : (
                <ul className="space-y-1">
                  {prog.runs.slice(0, 8).map((r) => {
                    const M = MODES.find((m) => m.id === r.mode)!;
                    return (
                      <li key={r.id} className="flex items-center gap-2 border-b border-line/50 py-1 last:border-0">
                        <M.icon className="h-3.5 w-3.5 text-moss" />
                        <span className="font-cond text-[11px] font-extrabold tracking-widest text-moss">{M.label}</span>
                        <span className="font-num text-[13px] font-extrabold text-chalk">{r.score.toLocaleString()}</span>
                        <span className="font-cond text-[10px] font-bold text-moss">V{r.wave} · {r.kills} splats · {Math.round(r.coverage * 100)}%</span>
                        {r.won === true && <Trophy className="h-3.5 w-3.5 text-gold" />}
                        <span className="ml-auto font-cond text-[10px] font-bold text-moss">{fmtDate(r.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
