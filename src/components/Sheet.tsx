import { Waves, Crosshair, Skull, Zap, Package, Gamepad2, ShieldCheck, Target } from "lucide-react";

/**
 * Fiche de jeu : ce que le joueur a entre les mains pendant une partie.
 * Les valeurs affichées sont celles réellement codées dans src/game/engine.ts.
 */

const rows: { icon: typeof Waves; title: string; tint: string; items: [string, string][] }[] = [
  {
    icon: Waves,
    title: "LA BOUCLE",
    tint: "text-cyan-hot",
    items: [
      ["Vagues infinies", "3 + 1,7 × n adversaires, jusqu'à 15 en même temps"],
      ["Boss toutes les 5 vagues", "420 PV, rafales en éventail, 1 600 pts"],
      ["Bonus de fin de vague", "220 × vague + peinture du court × 1 400, et +1 PV"],
    ],
  },
  {
    icon: Crosshair,
    title: "TON MARQUEUR",
    tint: "text-lime-hot",
    items: [
      ["Chargeur de 12 billes", "recharge 0,95 s (auto à zéro bille, R pour forcer)"],
      ["Cadence 0,108 s", "0,062 s en OVERCLOCK"],
      ["Dash 0,17 s", "recharge 1,05 s, i-frames 0,34 s — traverse les tirs"],
      ["6 peintures (PV)", "1,15 s d'invulnérabilité après un éclat"],
    ],
  },
  {
    icon: Skull,
    title: "LES ADVERSAIRES",
    tint: "text-magenta-hot",
    items: [
      ["GRAUNT", "60 PV, tient la position, 120 pts"],
      ["RUSHER", "48 PV, charge et percute, 170 pts"],
      ["SNIPER", "52 PV, laser annonciateur, 220 pts"],
      ["BOSS", "420 PV, salves en 3 temps, 1 600 pts"],
    ],
  },
  {
    icon: Zap,
    title: "LE SCORE",
    tint: "text-gold",
    items: [
      ["Multiplicateur x1 → x7", "2 / 4 / 7 / 11 / 16 / 22 splats enchaînés"],
      ["Fenêtre de combo", "3,4 s entre deux éliminations"],
      ["La peinture rapporte", "chaque tir manqué tache le court, et compte"],
    ],
  },
  {
    icon: Package,
    title: "LES RAMASSAGES",
    tint: "text-cyan-hot",
    items: [
      ["OVERCLOCK", "cadence doublée pendant 5 s"],
      ["TRIPLE STREAM", "trois jets pendant 9 s"],
      ["+PAINT", "2 peintures de vie"],
      ["BOUCLIER", "absorbe 2 echats"],
      ["RICOCHET", "les billes rebondissent 3 fois (12 s)"],
      ["BILLE EXPLOSIVE", "degats de zone a l impact (9 s)"],
      ["ROULEAU", "une vague de peinture ecrase le passage"],
    ],
  },
  {
    icon: Gamepad2,
    title: "LES MODES",
    tint: "text-lime-hot",
    items: [
      ["SOLO", "un pilote, les flèches ou WASD"],
      ["DUO LOCAL", "2 pilotes sur un clavier, revive en fin de vague"],
      ["CO-OP EN LIGNE", "salon privé à 4 lettres, WebRTC"],
      ["VERSUS 1v1", "à venir — demande un netcode compétitif"],
    ],
  },
];

export default function GameSheet() {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
        <Target className="h-4 w-4 text-gold" />
        <h3 className="font-display text-[12px] tracking-wide text-chalk">LA FICHE DU JEU</h3>
        <span className="ml-auto font-cond text-[10px] font-extrabold tracking-[0.2em] text-moss">
          AVANT DE TIRER
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {rows.map(({ icon: Icon, title, tint, items }) => (
          <div key={title} className="border-l-2 border-line pl-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <Icon className={"h-3.5 w-3.5 " + tint} />
              <h4 className="font-display text-[11px] tracking-wide text-chalk">{title}</h4>
            </div>
            <ul className="space-y-[3px]">
              {items.map(([k, v]) => (
                <li key={k} className="leading-tight">
                  <span className="font-cond text-[11px] font-extrabold tracking-[0.08em] text-chalk/85">{k}</span>
                  <span className="font-cond text-[11px] font-semibold tracking-wide text-moss"> — {v}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t-2 border-line px-3 py-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-hot" />
        <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
          EN COURS DE PARTIE : PAUSE pour souffler, SAUVEGARDER &amp; QUITTER pour reprendre plus tard, et le HUD
          garde tes peintures, la vague, le combo et la couverture du court en permanence.
        </p>
      </div>
    </div>
  );
}
