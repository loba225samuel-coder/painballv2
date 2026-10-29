/* Règles communes : solo, duo local et serveur autoritaire. */

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const WORLD = { w: 1280, h: 720 };

export const COL = {
  player: "#3ee8ff",
  grunt: "#ff2f87",
  rusher: "#ff8a1e",
  sniper: "#a86bff",
  boss: "#ffd84d",
  lime: "#b9ff33",
  chalk: "#e9f5ee",
};

export const PAINTS = [COL.grunt, COL.rusher, COL.player, COL.lime, COL.sniper, COL.boss, "#ff4a3d"];
export const COMBO_STEPS = [2, 4, 7, 11, 16, 22];

export type EType = "grunt" | "rusher" | "sniper" | "boss";

export const ENEMY_DEF: Record<EType, { hp: number; r: number; speed: number; score: number; color: string }> = {
  grunt: { hp: 60, r: 15, speed: 88, score: 120, color: COL.grunt },
  rusher: { hp: 48, r: 14, speed: 176, score: 170, color: COL.rusher },
  sniper: { hp: 52, r: 15, speed: 74, score: 220, color: COL.sniper },
  boss: { hp: 420, r: 30, speed: 62, score: 1600, color: COL.boss },
};

export const PLAYER = {
  r: 15,
  hp: 6,
  mag: 12,
  speed: 252,
  dashSpeed: 640,
  dashTime: 0.17,
  dashCd: 1.05,
  reload: 0.95,
  fire: 0.108,
  rapidFire: 0.062,
  bulletSpeed: 700,
  bulletDmg: 30,
};

/** Définitions normalisées du court (identiques au solo). */
export const ARENA_DEFS: [number, number, number, number][] = [
  [0.2, 0.22, 156, 44],
  [0.8, 0.22, 156, 44],
  [0.2, 0.78, 156, 44],
  [0.8, 0.78, 156, 44],
  [0.5, 0.5, 54, 176],
  [0.5, 0.08, 96, 96],
  [0.5, 0.92, 96, 96],
  [0.06, 0.5, 78, 96],
  [0.94, 0.5, 78, 96],
  [0.33, 0.5, 40, 104],
  [0.67, 0.5, 40, 104],
  [0.07, 0.14, 84, 44],
  [0.93, 0.14, 84, 44],
  [0.07, 0.86, 84, 44],
  [0.93, 0.86, 84, 44],
];

export interface Bunker {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeBunkers(w = WORLD.w, h = WORLD.h): Bunker[] {
  const u = clamp(Math.min(w, h) / 700, 0.72, 1.25);
  return ARENA_DEFS.map(([nx, ny, bw, bh]) => ({
    x: nx * w,
    y: ny * h,
    w: Math.max(46, bw * u),
    h: Math.max(46, bh * u),
  }));
}

export function comboMult(streak: number) {
  let m = 1;
  for (let i = 0; i < COMBO_STEPS.length; i++) if (streak >= COMBO_STEPS[i]) m = 2 + i;
  return m;
}

/* ---------------- Bonus ramassables ---------------- */

export type BonusKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const BONUS: Record<BonusKind, { id: string; name: string; short: string; color: string; duration: number }> = {
  0: { id: "rapid", name: "OVERCLOCK", short: "OVERCLOCK", color: COL.player, duration: 5 },
  1: { id: "med", name: "PEINTURE", short: "SOIN", color: COL.lime, duration: 0 },
  2: { id: "triple", name: "TRIPLE JET", short: "TRIPLE", color: COL.boss, duration: 9 },
  3: { id: "shield", name: "BOUCLIER DE PEINTURE", short: "BOUCLIER", color: "#7ef4ff", duration: 10 },
  4: { id: "ricochet", name: "RICOCHET", short: "RICOCHET", color: COL.sniper, duration: 8 },
  5: { id: "explosive", name: "BILLE EXPLOSIVE", short: "EXPLOSIF", color: COL.rusher, duration: 0 },
  6: { id: "roller", name: "ROULEAU DE PEINTURE", short: "ROULEAU", color: COL.lime, duration: 6 },
  7: { id: "turbo", name: "TURBO", short: "TURBO", color: "#ff4a3d", duration: 8 },
  8: { id: "cluster", name: "GRAPPE", short: "GRAPPE", color: "#e9f5ee", duration: 0 },
  9: { id: "ink", name: "ENCRE LENTE", short: "ENCRE", color: COL.sniper, duration: 8 },
  10: { id: "magnet", name: "AIMANT", short: "AIMANT", color: COL.lime, duration: 10 },
  11: { id: "prime", name: "PRIME", short: "PRIME", color: COL.boss, duration: 0 },
  12: { id: "dash", name: "DASH RECHARGÉ", short: "DASH +", color: "#55ddff", duration: 0 },
  13: { id: "comboFreeze", name: "COMBO GELÉ", short: "GEL COMBO", color: "#b8e6ff", duration: 5 },
};

/** Paramètres des bonus « PRIME / DASH+ / GEL » (solo uniquement). */
export const PRIME_PER_WAVE = 250;
export const COMBO_FREEZE_DURATION = 5;

/** Table de drop. Les bonus rares n'y figurent qu'une fois. */
export const DROP_TABLE: BonusKind[] = [
  0, 1, 2, 3, 4, 5, 6, 7, // fréquents
  0, 1, 4, 6, 3, 7, // courants
  8, 9, 10, // rares
];

/** Table solo : y ajoute les bonus réservés au solo (PRIME, DASH+, COMBO GELÉ). */
export const SOLO_DROP_TABLE: BonusKind[] = [...DROP_TABLE, 11, 12, 13];

/** Paramètres des nouveaux bonus (partagés solo / multi). */
export const TURBO_SPEED = 1.35;
export const TURBO_DURATION = 8;
export const GRAPPE_SHOTS = 5;
export const GRAPPE_SPREAD = 0.24;
export const GRAPPE_DMG = 15;
export const GRAPPE_LIFE = 0.72;
export const INK_DURATION = 8;
export const INK_SLOW_DURATION = 2;
export const INK_SLOW_FACTOR = 0.55;
export const MAGNET_DURATION = 10;
export const MAGNET_RADIUS = 300;
export const MAGNET_SPEED = 320; // px/s, vitesse max d’attraction

export function sanitizeName(name: unknown, fallback = "JOUEUR") {
  const s = String(name ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, 12);
  return s || fallback;
}
