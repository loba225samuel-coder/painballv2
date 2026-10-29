import { Globe2, CloudOff, Cloud, Trophy, Waves, Crosshair, Timer, Gamepad2, Loader2 } from "lucide-react";
import type { LinkState, Progress as ProgressT, WorldRow } from "@/lib/cloud";
import { fmtTime } from "@/lib/scores";

function Chip({ state }: { state: LinkState }) {
  if (state === "checking")
    return (
      <span className="inline-flex items-center gap-1.5 border border-line bg-court-600/60 px-2 py-[3px] font-cond text-[10px] font-extrabold tracking-[0.16em] text-moss">
        <Loader2 className="h-3 w-3 animate-spin" /> CONNEXION…
      </span>
    );
  if (state === "cloud")
    return (
      <span className="inline-flex items-center gap-1.5 border border-lime-hot/40 bg-lime-hot/15 px-2 py-[3px] font-cond text-[10px] font-extrabold tracking-[0.16em] text-lime-hot">
        <Cloud className="h-3 w-3" /> EN LIGNE
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-court-600/60 px-2 py-[3px] font-cond text-[10px] font-extrabold tracking-[0.16em] text-moss">
      <CloudOff className="h-3 w-3" /> HORS LIGNE
    </span>
  );
}

function Stat({ icon: Icon, label, value, tint }: { icon: typeof Trophy; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-line pl-2.5">
      <Icon className={"h-4 w-4 shrink-0 " + tint} />
      <div>
        <div className="font-cond text-[9px] font-extrabold leading-none tracking-[0.18em] text-moss">{label}</div>
        <div className="font-display text-[15px] leading-tight text-chalk">{value}</div>
      </div>
    </div>
  );
}

export function ProgressPanel({ progress, status }: { progress: ProgressT | null; status: LinkState }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
        <Gamepad2 className="h-4 w-4 text-cyan-hot" />
        <h3 className="font-display text-[12px] tracking-wide text-chalk">MA PROGRESSION</h3>
        <span className="ml-auto">
          <Chip state={status} />
        </span>
      </div>
      {status === "checking" ? (
        <div className="flex items-center gap-2 px-3 py-4 text-moss">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="font-cond text-[11px] font-bold tracking-[0.14em]">CHARGEMENT DE LA PROGRESSION…</p>
        </div>
      ) : progress ? (
        <div className="grid grid-cols-2 gap-2.5 p-3">
          <Stat icon={Trophy} label="MEILLEUR SCORE" value={progress.bestScore.toLocaleString()} tint="text-gold" />
          <Stat icon={Waves} label="VAGUE MAX" value={String(progress.bestWave)} tint="text-cyan-hot" />
          <Stat icon={Crosshair} label="ÉCLATS AU TOTAL" value={progress.totalKills.toLocaleString()} tint="text-magenta-hot" />
          <Stat icon={Gamepad2} label="PARTIES" value={String(progress.totalRuns)} tint="text-lime-hot" />
          <Stat icon={Timer} label="TEMPS DE JEU" value={fmtTime(progress.totalSeconds)} tint="text-moss" />
          <Stat
            icon={Globe2}
            label="PEINTURE CUMULÉE"
            value={`${Math.round(progress.totalPaint * 100)} %`}
            tint="text-lime-hot"
          />
        </div>
      ) : (
        <div className="px-3 py-3">
          <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
            {status === "cloud"
              ? "AUCUNE PARTIE ENREGISTRÉE POUR L'INSTANT — TERMINE UNE PARTIE ET TOUT SERA SAUVÉ ICI."
              : "HORS LIGNE : TES RECORDS RESTENT SUR CET APPAREIL. LA PROGRESSION SERA SYNCHRONISÉE DÈS LE RETOUR DU RÉSEAU."}
          </p>
        </div>
      )}
    </div>
  );
}

export function WorldBoard({ rows, status }: { rows: WorldRow[] | null; status: LinkState }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
        <Globe2 className="h-4 w-4 text-lime-hot" />
        <h3 className="font-display text-[12px] tracking-wide text-chalk">CLASSEMENT MONDIAL</h3>
        <span className="ml-auto">
          <Chip state={status} />
        </span>
      </div>
      {status === "checking" ? (
        <div className="flex items-center gap-2 px-3 py-4 text-moss">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="font-cond text-[11px] font-bold tracking-[0.14em]">CONNEXION À LA BASE…</p>
        </div>
      ) : status === "local" ? (
        <div className="flex items-start gap-2 px-3 py-3">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
          <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
            CLASSEMENT INDISPONIBLE HORS LIGNE. LE TABLEAU DE CET APPAREIL RESTE EN HAUT DE L'ÉCRAN.
          </p>
        </div>
      ) : rows && rows.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr className="font-cond text-[10px] tracking-[0.18em] text-moss">
              <th className="px-3 py-1 font-extrabold">#</th>
              <th className="py-1 font-extrabold">JOUEUR</th>
              <th className="py-1 text-right font-extrabold">SCORE</th>
              <th className="py-1 text-right font-extrabold">VAGUE</th>
              <th className="py-1 pr-3 text-right font-extrabold">ÉCLATS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.created_at + "-" + i}
                className={"font-cond text-[13px] font-bold " + (i === 0 ? "text-gold" : "text-chalk/85")}
              >
                <td className="px-3 py-[3px] font-num">{i + 1}</td>
                <td className="py-[3px] tracking-[0.12em]">
                  {r.name}
                  {r.duo && <span className="ml-1.5 font-cond text-[9px] tracking-[0.14em] text-lime-hot">DUO</span>}
                </td>
                <td className="py-[3px] text-right font-num">{r.score.toLocaleString()}</td>
                <td className="py-[3px] text-right font-num text-moss">{r.wave}</td>
                <td className="py-[3px] pr-3 text-right font-num text-moss">{r.kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-3 py-3">
          <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
            AUCUNE PARTIE MONDIALE POUR L'INSTANT — SOIS LE PREMIER NOM DU TABLEAU.
          </p>
        </div>
      )}
    </div>
  );
}
