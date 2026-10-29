import { Sfx } from "./audio";
import type { RemoteInput, Snapshot } from "./net";

/* ------------------------------------------------------------------ *
 * PAINTBALL 2D — top-down arcade paintball arena
 * Everything the sim needs lives here; React only draws the menus/HUD.
 * ------------------------------------------------------------------ */

export type Status = "menu" | "playing" | "paused" | "gameover";

export interface Pilot {
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  hp: number;
  maxHp: number;
  invuln: number;
  ammo: number;
  mag: number;
  reload: number;
  reloadFrom: number;
  fireT: number;
  bloom: number;
  dashT: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  tripleT: number;
  rapidT: number;
  hitFlash: number;
  step: number;
  dead: boolean;
  shield: number;
  ricochetT: number;
  boomT: number;
}

export interface PilotHud {
  shield: number;
  hp: number;
  maxHp: number;
  ammo: number;
  mag: number;
  dead: boolean;
}

export interface HudState {
  hp: number;
  maxHp: number;
  score: number;
  wave: number;
  combo: number;
  comboPct: number;
  enemies: number;
  coverage: number;
  ammo: number;
  mag: number;
  time: number;
  dashPct: number;
  powerName: string;
  powerPct: number;
  duo: boolean;
  shield: number;
  p2: PilotHud | null;
}

export interface RunResult {
  duo: boolean;
  score: number;
  wave: number;
  kills: number;
  kills2: number;
  shots: number;
  hits: number;
  hits2: number;
  maxCombo: number;
  coverage: number;
  time: number;
}

interface Callbacks {
  onHud: (h: HudState) => void;
  onStatus: (s: Status) => void;
  onGameOver: (r: RunResult) => void;
}

type EType = "grunt" | "rusher" | "sniper" | "boss";

export interface Enemy {
  type: EType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  angle: number;
  speed: number;
  fireT: number;
  charge: number;
  strafe: number;
  strafeT: number;
  lungeT: number;
  coolT: number;
  flash: number;
  wobble: number;
  volley: number;
  stormT: number;
  born: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
  dmg: number;
  color: string;
  foe: boolean;
  owner: number;
  bounce: number;
  boom: boolean;
}

interface Particle {
  kind: 0 | 1 | 2 | 3 | 4; // drop, spark, smoke, ring, text
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  paint: number;
  text: string;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  kind: number; // index PICKUPS
}

interface Roller {
  x: number;
  y: number;
  a: number;
  t: number;
  life: number;
  speed: number;
  w: number;
  hit: Set<Enemy>;
}

/** Ramassages : label de la caisse, nom affiché, couleur, poids de drop. */
const PICKUPS = [
  { label: ">>", name: "OVERCLOCK", color: "#3ee8ff", weight: 22 },
  { label: "+", name: "+PAINT", color: "#b9ff33", weight: 18 },
  { label: "3x", name: "TRIPLE STREAM", color: "#ffd84d", weight: 18 },
  { label: "S", name: "BOUCLIER", color: "#7ef4ff", weight: 16 },
  { label: "R", name: "RICOCHET", color: "#a86bff", weight: 14 },
  { label: "!", name: "BILLE EXPLOSIVE", color: "#ff8a1e", weight: 12 },
  { label: "O", name: "ROULEAU", color: "#ff2f87", weight: 10 },
];

function rollPickup() {
  const total = PICKUPS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PICKUPS.length; i++) {
    r -= PICKUPS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

interface Telegraph {
  x: number;
  y: number;
  t: number;
  dur: number;
  type: EType;
}

interface Banner {
  text: string;
  sub: string;
  t: number;
  dur: number;
  color: string;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b?: number) => (b === undefined ? Math.random() * a : b + Math.random() * (a - b));

const COL = {
  player: "#3ee8ff",
  grunt: "#ff2f87",
  rusher: "#ff8a1e",
  sniper: "#a86bff",
  boss: "#ffd84d",
  lime: "#b9ff33",
  chalk: "#e9f5ee",
};
const PAINTS = [COL.grunt, COL.rusher, COL.player, "#b9ff33", COL.sniper, COL.boss, "#ff4a3d"];
const PAD = 34;
const COMBO_STEPS = [2, 4, 7, 11, 16, 22];

const ENEMY_DEF: Record<EType, { hp: number; r: number; speed: number; score: number; color: string }> = {
  grunt: { hp: 60, r: 15, speed: 88, score: 120, color: COL.grunt },
  rusher: { hp: 48, r: 14, speed: 176, score: 170, color: COL.rusher },
  sniper: { hp: 52, r: 15, speed: 74, score: 220, color: COL.sniper },
  boss: { hp: 420, r: 30, speed: 62, score: 1600, color: COL.boss },
};

export interface SaveState {
  v: 1;
  at: number;
  label: string;
  duo: boolean;
  gw: number;
  gh: number;
  score: number;
  wave: number;
  kills: number;
  shots: number;
  hits: number;
  streak: number;
  maxCombo: number;
  time: number;
  between: number;
  spawnT: number;
  maxAlive: number;
  pending: string[];
  pilots: Pilot[];
  enemies: Enemy[];
  covered: string;
  paint?: string;
}

function gridToB64(u8: Uint8Array) {
  let out = "";
  for (let i = 0; i < u8.length; i += 8192) out += String.fromCharCode(...u8.subarray(i, i + 8192));
  return btoa(out);
}
function b64ToGrid(b64: string) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export class PaintballGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  sfx = new Sfx(localStorage.getItem("pb.muted") === "1");

  status: Status = "menu";
  private raf = 0;
  private last = 0;
  private dead = false;

  // view / world
  private W = 1200;
  private H = 700;
  private s = 1;
  private cssW = 1200;
  private cssH = 700;
  private floor = document.createElement("canvas");
  private paint = document.createElement("canvas");
  private bunkers: { x: number; y: number; w: number; h: number }[] = [];
  private cell = 46;
  private gw = 1;
  private gh = 1;
  private covered!: Uint8Array;
  private coveredCount = 0;

  // sprite caches
  private splats = new Map<string, HTMLCanvasElement>();
  private glows = new Map<string, HTMLCanvasElement>();
  private splatV = 0;

  // entities
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private parts: Particle[] = [];
  private pickups: Pickup[] = [];
  private rollers: Roller[] = [];
  private telegraphs: Telegraph[] = [];
  private banners: Banner[] = [];

  private p: Pilot = {
    i: 0,
    dead: false,
    x: 600,
    y: 350,
    vx: 0,
    vy: 0,
    r: 15,
    angle: 0,
    hp: 6,
    maxHp: 6,
    invuln: 0,
    ammo: 12,
    mag: 12,
    reload: 0,
    fireT: 0,
    bloom: 0,
    dashT: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 0,
    tripleT: 0,
    rapidT: 0,
    hitFlash: 0,
    step: 0,
    reloadFrom: 0,
    shield: 0,
    ricochetT: 0,
    boomT: 0,
  };
  private p2: Pilot | null = null;
  private duo = false;
  /** index du pilote tenu par les commandes locales (1 côté client en ligne) */
  private localIdx = 0;
  private queued = { dash: false, reload: false };
  private netPilot: { idx: number; input: RemoteInput | null } | null = null;
  private killsBy = [0, 0];
  private hitsBy = [0, 0];

  // run state
  private score = 0;
  private wave = 0;
  private kills = 0;
  private shots = 0;
  private hits = 0;
  private comboT = 0;
  private maxCombo = 0;
  private streak = 0;
  private time = 0;
  private dying = 0;
  private pending: EType[] = [];
  private spawnT = 0;
  private between = 0;
  private maxAlive = 8;

  // fx
  private trauma = 0;
  private hitstop = 0;
  private flashAmt = 0;
  private flashCol = "#ffffff";
  private shakeX = 0;
  private shakeY = 0;
  private hudT = 0;
  private ghost = { x: 600, y: 350, a: 0 };

  // input
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, used: false };
  private stickMove = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
  private stickAim = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 0 };
  private isTouch =
    typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)")?.matches;
  private btn = {
    fire: { x: 0, y: 0, r: 46, press: 0, id: -1 },
    dash: { x: 0, y: 0, r: 34, press: 0, id: -1 },
    reload: { x: 0, y: 0, r: 30, press: 0, id: -1 },
  };
  /** emplacements « maison » des sticks (repères visuels quand rien n'est touché) */
  private home = { mx: 90, my: 500, ax: 900, ay: 260 };
  private vibe = typeof localStorage !== "undefined" && localStorage.getItem("pb.vibe") !== "0";
  private tutorialT = 0;
  private maxParts = 760;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
    this.buildSprites();
    this.resize();
    this.mount();
    this.spawnMenuDemo();
    this.loopStart();
    this.cb.onStatus("menu");
  }

  /* ---------------- lifecycle ---------------- */

  private mount() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("contextmenu", this.onCtx);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("contextmenu", this.onCtx);
  }

  private onCtx = (e: Event) => e.preventDefault();

  private onBlur = () => {
    if (this.status === "playing") this.pause();
    this.keys.clear();
    this.mouse.down = false;
    this.stickMove.active = false;
    this.stickAim.active = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (k === "Space" || k.startsWith("Arrow")) e.preventDefault();
    this.keys.add(k);
    if (k === "Escape" || k === "KeyP") {
      if (this.status === "playing") this.pause();
      else if (this.status === "paused") this.resume();
      return;
    }
    if (this.status !== "playing") return;
    if (k === "KeyR") this.startReload(this.localPilot());
    if (k === "ShiftLeft") this.tryDash(this.localPilot());
    if (k === "ShiftRight" || k === "ControlRight") {
      if (this.p2) this.tryDash(this.p2);
      else this.tryDash(this.localPilot());
    }
    if (this.p2 && (k === "Period" || k === "NumpadDecimal")) this.startReload(this.p2);
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private screenToWorld(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.s, y: (e.clientY - r.top) / this.s, px: e.clientX - r.left, py: e.clientY - r.top };
  }

  private hitBtn(px: number, py: number, k: "fire" | "dash" | "reload") {
    const b = this.btn[k];
    return Math.hypot(px - b.x, py - b.y) <= b.r * 1.22;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.sfx.unlock();
    const { x, y, px, py } = this.screenToWorld(e);
    if (e.pointerType === "mouse") {
      this.mouse.used = true;
      this.mouse.x = x;
      this.mouse.y = y;
      if (e.button === 0) this.mouse.down = true;
      return;
    }
    if (!this.isTouch) {
      this.isTouch = true;
      this.maxParts = 430;
      this.layoutTouch();
    }
    // la gestuelle disparaît doucement dès que le joueur commence à toucher
    this.tutorialT = Math.min(this.tutorialT, 1.8);
    const b = this.btn;
    // --- cluster de boutons sous le pouce droit ---
    if (this.status === "playing" && this.hitBtn(px, py, "fire")) {
      b.fire.id = e.pointerId;
      b.fire.press = 0.16;
      this.capture(e.pointerId);
      return;
    }
    if (this.status === "playing" && this.hitBtn(px, py, "dash")) {
      b.dash.id = e.pointerId;
      b.dash.press = 0.16;
      this.tryDash(this.p);
      this.capture(e.pointerId);
      return;
    }
    if (this.status === "playing" && this.hitBtn(px, py, "reload")) {
      b.reload.id = e.pointerId;
      b.reload.press = 0.16;
      this.startReload(this.localPilot());
      this.capture(e.pointerId);
      return;
    }
    // --- sticks : moitié gauche = déplacement, sinon visée ---
    const left = px < this.cssW * 0.5;
    if (left ? !this.stickMove.active : !this.stickAim.active) {
      const st = left ? this.stickMove : this.stickAim;
      st.active = true;
      st.id = e.pointerId;
      // l'origine s'ancre là où le pouce se pose, sauf si c'est déjà un stick libre
      st.ox = px;
      st.oy = py;
      st.x = px;
      st.y = py;
      st.dx = 0;
      st.dy = 0;
      if (!left) {
        this.stickAim.mag = 0;
        this.stickAim.dx = 1;
      }
    } else if (!left && this.stickAim.active) {
      // pouce droit déjà occupé par le tir : un second doigt peut viser
      this.stickAim.id = e.pointerId;
      this.stickAim.ox = px;
      this.stickAim.oy = py;
    }
    this.capture(e.pointerId);
  };

  private capture(id: number) {
    try {
      this.canvas.setPointerCapture(id);
    } catch {
      /* noop */
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const { x, y, px, py } = this.screenToWorld(e);
    if (e.pointerType === "mouse") {
      this.mouse.used = true;
      this.mouse.x = x;
      this.mouse.y = y;
      return;
    }
    const R = this.stickR;
    for (const st of [this.stickMove, this.stickAim]) {
      if (st.active && st.id === e.pointerId) {
        let dx = px - st.ox;
        let dy = py - st.oy;
        let d = Math.hypot(dx, dy);
        // petit pied mort : évite les micro-tremblements de pouce
        if (d < 7) {
          dx = 0;
          dy = 0;
          d = 0;
        }
        if (d > R) {
          st.x = st.ox + (dx / d) * R;
          st.y = st.oy + (dy / d) * R;
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        } else {
          st.x = px;
          st.y = py;
        }
        st.dx = dx / R;
        st.dy = dy / R;
        if ("mag" in st) st.mag = Math.min(1, d / R);
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (e.button === 0) this.mouse.down = false;
      return;
    }
    for (const k of ["fire", "dash", "reload"] as const) {
      if (this.btn[k].id === e.pointerId) this.btn[k].id = -1;
    }
    if (this.stickMove.id === e.pointerId) {
      this.stickMove.active = false;
      this.stickMove.id = -1;
      this.stickMove.dx = 0;
      this.stickMove.dy = 0;
    }
    if (this.stickAim.id === e.pointerId) {
      this.stickAim.active = false;
      this.stickAim.id = -1;
      this.stickAim.dx = 0;
      this.stickAim.dy = 0;
      this.stickAim.mag = 0;
    }
  };

  /** les pilotes vivants de la partie */
  private pilots(): Pilot[] {
    return this.p2 ? [this.p, this.p2] : [this.p];
  }

  private makePilot(i: number): Pilot {
    return {
      i,
      dead: false,
      x: this.W / 2 + (i === 0 ? -52 : 52),
      y: this.H * 0.72,
      vx: 0,
      vy: 0,
      r: 15,
      angle: -Math.PI / 2,
      hp: 6,
      maxHp: 6,
      invuln: 1.2,
      ammo: 12,
      mag: 12,
      reload: 0,
      reloadFrom: 0,
      fireT: 0,
      bloom: 0,
      dashT: 0,
      dashCd: 0,
      dashX: 0,
      dashY: 0,
      tripleT: 0,
      rapidT: 0,
      hitFlash: 0,
      step: 0,
      shield: 0,
      ricochetT: 0,
      boomT: 0,
    };
  }

  /** pilote le plus proche d'un point (pour l'IA et les tirs) */
  private nearestPilot(x: number, y: number): { p: Pilot; idx: number } | null {
    let best: Pilot | null = null;
    let bd = 1e9;
    for (const pl of this.pilots()) {
      if (pl.dead) continue;
      const d = Math.hypot(pl.x - x, pl.y - y);
      if (d < bd) {
        bd = d;
        best = pl;
      }
    }
    return best ? { p: best, idx: best.i } : null;
  }

  private allDown() {
    return this.pilots().every((pl) => pl.dead);
  }

  private get stickR() {
    return Math.min(74, Math.max(52, this.cssW * 0.06));
  }

  /** insets d'encoche (px CSS) + marges de jeu qui en découlent (unités monde) */
  private safe = { t: 0, r: 0, b: 0, l: 0 };
  private mT = 16;
  private mR = 16;
  private mB = 16;
  private mL = 16;

  /* ---------------- arena / view ---------------- */

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // pendant un layout mobile, la mesure peut être nulle : on retentera plus tard
    if (rect.width < 2 || rect.height < 2) {
      this.sizeDirty = true;
      return;
    }
    const cssW = Math.max(280, rect.width || window.innerWidth);
    const cssH = Math.max(240, rect.height || window.innerHeight);
    // adaptive pixel density: keep big phone screens glued to 60fps
    const raw = window.devicePixelRatio || 1;
    const dpr = cssW * cssH > 1_350_000 ? Math.min(1.25, raw) : Math.min(2, raw);
    const long = Math.max(cssW, cssH);
    const short = Math.min(cssW, cssH);
    let s = Math.min(long / 1300, short / 640);
    s = Math.max(0.42, s);
    // en portrait très haut, on zoome : le combat reste à portée de pouce
    if (cssH / cssW > 1.45) s = Math.max(s, Math.min(cssH / 1120, cssW / 520));
    const W = cssW / s;
    const H = cssH / s;
    const big = Math.max(W, H);
    if (big > 1700) s *= big / 1700;

    this.cssW = cssW;
    this.cssH = cssH;
    this.s = s;
    this.W = cssW / s;
    this.H = cssH / s;
    // la taille AFFICHÉE reste pilotée par le CSS (w-full h-full) : on ne touche
    // qu'à la résolution interne. Figer style.width/height laissait le canvas
    // bloqué sur la première mesure (barre d'URL mobile) → jeu réduit à un coin.
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;

    // garde-fou encoche / barre d'accueil (vars CSS alimentées par env())
    try {
      const cs = getComputedStyle(document.documentElement);
      this.safe.t = parseFloat(cs.getPropertyValue("--sa-t")) || 0;
      this.safe.r = parseFloat(cs.getPropertyValue("--sa-r")) || 0;
      this.safe.b = parseFloat(cs.getPropertyValue("--sa-b")) || 0;
      this.safe.l = parseFloat(cs.getPropertyValue("--sa-l")) || 0;
    } catch {
      /* pas de vars dispo : on reste sur les marges de base */
    }
    // on ne rogne le terrain que du strict nécessaire (max 20 px CSS par bord)
    const cap = (v: number) => Math.min(v, 20);
    const m = 16;
    this.mT = m + cap(this.safe.t) / s;
    this.mR = m + cap(this.safe.r) / s;
    this.mB = m + cap(this.safe.b) / s;
    this.mL = m + cap(this.safe.l) / s;
    this.layoutTouch();
    this.maxParts = this.isTouch ? 430 : 760;

    this.buildArena();
  }

  /** cluster de boutons sous le pouce droit + Repères des sticks */
  private layoutTouch() {
    const { cssW, cssH } = this;
    const R = this.stickR;
    const tight = Math.min(cssW, cssH);
    const b = this.btn;
    b.fire.r = Math.round(clamp(tight * 0.095, 36, 56));
    b.fire.x = cssW - b.fire.r - 16 - this.safe.r;
    b.fire.y = cssH - b.fire.r - 18 - this.safe.b;
    b.dash.r = Math.round(b.fire.r * 0.78);
    b.dash.x = b.fire.x - b.fire.r - b.dash.r - 8;
    b.dash.y = b.fire.y - b.fire.r * 0.42;
    b.reload.r = Math.round(b.fire.r * 0.64);
    b.reload.x = b.fire.x - b.fire.r * 0.34;
    b.reload.y = b.fire.y - b.fire.r - b.reload.r - 6;
    // pouce gauche : déplacer — pouce droit : viser (dans la bande libre au-dessus du cluster)
    this.home.mx = 22 + this.safe.l + R;
    this.home.my = cssH - 22 - this.safe.b - R;
    const bandTop = this.safe.t + 64;
    const bandBot = b.reload.y - b.reload.r - 10;
    this.home.ax = Math.max(cssW * 0.6, cssW - 26 - this.safe.r - R);
    this.home.ay = bandBot - R > bandTop ? bandBot - R : cssH * 0.45;
  }
  private dpr = 1;
  private sizeDirty = true;
  private frameCount = 0;

  /** Détecte un changement de taille non signalé (barre d'URL, rotation, clavier). */
  private checkSize() {
    const r = this.canvas.getBoundingClientRect();
    if (Math.abs(r.width - this.cssW) > 2 || Math.abs(r.height - this.cssH) > 2 || this.sizeDirty) {
      this.sizeDirty = false;
      this.resize();
    }
  }

  private buildArena() {
    const { W, H } = this;
    const u = clamp(Math.min(W, H) / 700, 0.72, 1.25);
    // normalized court props -> world rects
    const defs: [number, number, number, number][] = [
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
    this.bunkers = defs.map(([nx, ny, w, h]) => ({
      x: nx * W,
      y: ny * H,
      w: Math.max(46, w * u),
      h: Math.max(46, h * u),
    }));

    // une rotation ne doit JAMAIS effacer la partie : on conserve peinture et
    // couverture, simplement rééchantillonnées sur la nouvelle taille.
    const oldGrid = this.covered;
    const oldGw = this.gw;
    const oldGh = this.gh;
    const oldPaint = this.paint;
    const oldPW = oldPaint.width;
    const oldPH = oldPaint.height;

    this.cell = 46;
    this.gw = Math.max(1, Math.ceil(W / this.cell));
    this.gh = Math.max(1, Math.ceil(H / this.cell));
    this.covered = new Uint8Array(this.gw * this.gh);
    this.coveredCount = 0;
    if (oldGrid && oldGrid.length) {
      if (oldGw === this.gw && oldGh === this.gh && oldGrid.length === this.covered.length) {
        this.covered.set(oldGrid);
        for (let i = 0; i < oldGrid.length; i++) if (oldGrid[i]) this.coveredCount++;
      } else if (oldGw > 0 && oldGh > 0) {
        // on projette l'ANCIENNE grille dans la nouvelle (et non l'inverse) :
        // aucune cellule peinte n'est perdue quand le format de l'écran change.
        for (let oy = 0; oy < oldGh; oy++) {
          for (let ox = 0; ox < oldGw; ox++) {
            if (!oldGrid[oy * oldGw + ox]) continue;
            const nx = Math.min(this.gw - 1, Math.floor((ox / oldGw) * this.gw));
            const ny = Math.min(this.gh - 1, Math.floor((oy / oldGh) * this.gh));
            const i = ny * this.gw + nx;
            if (!this.covered[i]) {
              this.covered[i] = 1;
              this.coveredCount++;
            }
          }
        }
      }
    }

    const fw = Math.round(W + PAD * 2);
    const fh = Math.round(H + PAD * 2);
    this.floor.width = fw;
    this.floor.height = fh;
    this.paint.width = Math.round(W);
    this.paint.height = Math.round(H);
    this.paintCtx = this.paint.getContext("2d")!;
    if (oldPW > 0 && oldPH > 0 && (oldPW !== this.paint.width || oldPH !== this.paint.height)) {
      try {
        this.paintCtx.drawImage(oldPaint, 0, 0, oldPW, oldPH, 0, 0, this.paint.width, this.paint.height);
      } catch {
        /* terrain redessiné : la partie reste jouable */
      }
    }
    this.bakeFloor();
  }
  private paintCtx!: CanvasRenderingContext2D;

  /** static court art (floor, lines, bunkers, decor) baked once */
  private bakeFloor() {
    const g = this.floor.getContext("2d")!;
    const { W, H } = this;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.floor.width, this.floor.height);
    // out-of-bounds pit
    g.fillStyle = "#070d0b";
    g.fillRect(0, 0, this.floor.width, this.floor.height);
    g.save();
    g.translate(PAD, PAD);

    // court base
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#1d302a");
    grd.addColorStop(0.5, "#223930");
    grd.addColorStop(1, "#182723");
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // tile grid
    g.strokeStyle = "rgba(233,245,238,0.035)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 58) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 58) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // speckle wear
    for (let i = 0; i < Math.floor((W * H) / 900); i++) {
      g.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(233,245,238,0.035)";
      const r = rnd(0.6, 2.2);
      g.fillRect(rnd(W), rnd(H), r, r);
    }

    // chalk markings
    g.strokeStyle = "rgba(233,245,238,0.34)";
    g.lineWidth = 4;
    g.strokeRect(28, 28, W - 56, H - 56);
    g.lineWidth = 3;
    g.strokeStyle = "rgba(233,245,238,0.18)";
    g.beginPath();
    g.moveTo(W / 2, 28);
    g.lineTo(W / 2, H - 28);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H / 2, Math.min(W, H) * 0.16, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H / 2, Math.min(W, H) * 0.055, 0, TAU);
    g.stroke();
    // goal arcs
    g.strokeStyle = "rgba(62,232,255,0.22)";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(28, H / 2, Math.min(W, H) * 0.24, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.strokeStyle = "rgba(255,47,135,0.22)";
    g.beginPath();
    g.arc(W - 28, H / 2, Math.min(W, H) * 0.24, Math.PI / 2, -Math.PI / 2);
    g.stroke();

    // faint "PAINTBALL" wordmark on court
    g.save();
    g.globalAlpha = 0.05;
    g.fillStyle = "#e9f5ee";
    g.font = `700 ${Math.min(W, H) * 0.16}px Bungee, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("PB2D", W / 2, H / 2);
    g.restore();

    // bunkers
    for (const b of this.bunkers) {
      const x = b.x - b.w / 2;
      const y = b.y - b.h / 2;
      g.fillStyle = "rgba(0,0,0,0.4)";
      this.rr(g, x + 7, y + 11, b.w, b.h, 9);
      g.fill();
      const bg = g.createLinearGradient(x, y, x, y + b.h);
      bg.addColorStop(0, "#6e6448");
      bg.addColorStop(0.55, "#565038");
      bg.addColorStop(1, "#3d3a29");
      g.fillStyle = bg;
      this.rr(g, x, y, b.w, b.h, 9);
      g.fill();
      g.strokeStyle = "#131d19";
      g.lineWidth = 3;
      this.rr(g, x, y, b.w, b.h, 9);
      g.stroke();
      // panel seams
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 6, y + b.h / 2);
      g.lineTo(x + b.w - 6, y + b.h / 2);
      g.stroke();
      g.strokeStyle = "rgba(233,245,238,0.14)";
      g.beginPath();
      g.moveTo(x + 6, y + 5);
      g.lineTo(x + b.w - 6, y + 5);
      g.stroke();
      // old paint on the bunkers
      for (let i = 0; i < 4; i++) {
        const sx = x + rnd(b.w);
        const sy = y + rnd(b.h);
        const c = PAINTS[(Math.random() * PAINTS.length) | 0];
        const key = c + "|" + ((Math.random() * 4) | 0);
        const sp = this.splats.get(key)!;
        const size = rnd(22, 46);
        g.globalAlpha = 0.85;
        g.drawImage(sp, sx - size / 2, sy - size / 2, size, size);
        g.globalAlpha = 1;
      }
    }
    g.restore();

    // ---- below here we are back in raw canvas space (court starts at PAD,PAD) ----
    const cw = this.floor.width;
    const ch = this.floor.height;
    // out-of-bounds pit framing everything
    g.fillStyle = "#050c0a";
    g.fillRect(0, 0, cw, PAD - 3);
    g.fillRect(0, ch - (PAD - 3), cw, PAD - 3);
    g.fillRect(0, 0, PAD - 3, ch);
    g.fillRect(cw - (PAD - 3), 0, PAD - 3, ch);
    // baked vignette (no per-frame gradient fills needed)
    const vg = g.createRadialGradient(
      PAD + W / 2,
      PAD + H / 2,
      Math.min(W, H) * 0.3,
      PAD + W / 2,
      PAD + H / 2,
      Math.max(W, H) * 0.72
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = vg;
    g.fillRect(PAD, PAD, W, H);
    // hazard tape just outside the chalk line
    g.save();
    g.lineWidth = 9;
    g.strokeStyle = "rgba(255,216,77,0.4)";
    g.setLineDash([17, 13]);
    g.strokeRect(PAD - 9, PAD - 9, W + 18, H + 18);
    g.setLineDash([]);
    g.restore();
    // arena lip
    g.strokeStyle = "rgba(44,71,64,0.95)";
    g.lineWidth = 4;
    g.strokeRect(PAD - 1.5, PAD - 1.5, W + 3, H + 3);
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(PAD - 3, PAD - 3, W + 6, 3);
  }

  private rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  private clearPaint() {
    const g = this.paintCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
  }

  private buildSprites() {
    const S = 88;
    for (const c of [...PAINTS, "#ffffff", COL.chalk]) {
      for (let v = 0; v < 4; v++) {
        const cv = document.createElement("canvas");
        cv.width = S;
        cv.height = S;
        const g = cv.getContext("2d")!;
        g.fillStyle = c;
        g.strokeStyle = c;
        g.lineCap = "round";
        const cx = S / 2;
        g.beginPath();
        g.arc(cx, cx, S * 0.17, 0, TAU);
        g.fill();
        const n = 6 + (v % 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + v * 0.9 + rnd(0.5);
          const len = S * rnd(0.12, 0.36);
          const px = cx + Math.cos(a) * (S * 0.14 + len);
          const py = cx + Math.sin(a) * (S * 0.14 + len);
          g.lineWidth = S * rnd(0.05, 0.11);
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * S * 0.08, cx + Math.sin(a) * S * 0.08);
          g.lineTo(px, py);
          g.stroke();
          g.beginPath();
          g.arc(px, py, S * rnd(0.03, 0.08), 0, TAU);
          g.fill();
        }
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.arc(cx + rnd(-1, 1) * S * 0.44, cx + rnd(-1, 1) * S * 0.44, rnd(1.5, 4), 0, TAU);
          g.fill();
        }
        this.splats.set(c + "|" + v, cv);
      }
      const gv = document.createElement("canvas");
      gv.width = gv.height = 48;
      const gg = gv.getContext("2d")!;
      const rad = gg.createRadialGradient(24, 24, 0, 24, 24, 24);
      rad.addColorStop(0, c);
      rad.addColorStop(0.35, c + "aa");
      rad.addColorStop(1, c + "00");
      gg.fillStyle = rad;
      gg.fillRect(0, 0, 48, 48);
      this.glows.set(c, gv);
    }
  }

  /* ---------------- paint splatting ---------------- */

  private splat(x: number, y: number, color: string, size: number, alpha = 0.92) {
    if (x < 0 || y < 0 || x > this.W || y > this.H) return;
    const g = this.paintCtx;
    const key = color + "|" + ((this.splatV++ % 4) | 0);
    const sp = this.splats.get(key) ?? this.splats.get(PAINTS[0] + "|0")!;
    g.globalAlpha = alpha;
    g.save();
    g.translate(x, y);
    g.rotate(rnd(TAU));
    g.drawImage(sp, -size / 2, -size / 2, size, size);
    g.restore();
    g.globalAlpha = 1;
    this.mark(x, y);
    if (size > 26) {
      this.mark(x + rnd(-1, 1) * size * 0.5, y + rnd(-1, 1) * size * 0.5);
    }
  }

  private mark(x: number, y: number) {
    const i = clamp(Math.floor(y / this.cell), 0, this.gh - 1) * this.gw + clamp(Math.floor(x / this.cell), 0, this.gw - 1);
    if (!this.covered[i]) {
      this.covered[i] = 1;
      this.coveredCount++;
    }
  }

  private get coverage() {
    return this.coveredCount / Math.max(1, this.gw * this.gh);
  }

  /* ---------------- fx helpers ---------------- */

  private addTrauma(n: number) {
    this.trauma = Math.min(1, this.trauma + n);
  }
  private flash(col: string, amt: number) {
    this.flashCol = col;
    this.flashAmt = Math.max(this.flashAmt, amt);
  }
  private part(p: Partial<Particle> & { x: number; y: number }) {
    if (this.parts.length > this.maxParts) return;
    this.parts.push({
      kind: 0,
      vx: 0,
      vy: 0,
      life: 0.5,
      max: 0.5,
      size: 3,
      color: COL.chalk,
      rot: 0,
      vr: 0,
      paint: 0,
      text: "",
      ...p,
    } as Particle);
  }
  private spray(x: number, y: number, color: string, n: number, spd: number, spread = TAU, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-spread / 2, spread / 2) + rnd(-0.2, 0.2);
      const v = spd * rnd(0.35, 1.15);
      this.part({
        kind: 0,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rnd(0.24, 0.62),
        max: 0.62,
        size: rnd(2, 5.4),
        color,
        paint: Math.random() < 0.5 ? 1 : 0,
      });
    }
  }
  private ring(x: number, y: number, color: string, size: number, life = 0.3) {
    this.part({ kind: 3, x, y, life, max: life, size, color });
  }
  private popText(x: number, y: number, text: string, color: string, size = 20) {
    this.part({ kind: 4, x, y, vy: -46, life: 0.9, max: 0.9, text, color, size });
  }
  private banner(text: string, sub: string, color: string, dur = 1.5) {
    this.banners.push({ text, sub, t: 0, dur, color });
    if (this.banners.length > 4) this.banners.shift();
  }

  /* ---------------- run control ---------------- */

  private resetRun() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.parts.length = 0;
    this.pickups.length = 0;
    this.rollers.length = 0;
    this.telegraphs.length = 0;
    this.banners.length = 0;
    this.pending.length = 0;
    this.clearPaint();
    this.p = this.makePilot(0);
    this.p2 = this.duo ? this.makePilot(1) : null;
    this.killsBy = [0, 0];
    this.hitsBy = [0, 0];
    this.score = 0;
    this.wave = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.comboT = 0;
    this.streak = 0;
    this.maxCombo = 0;
    this.time = 0;
    this.dying = 0;
    this.between = 0;
    this.spawnT = 0;
    this.trauma = 0;
    this.flashAmt = 0;
  }

  start(duo = false) {
    this.sfx.unlock();
    this.duo = duo;
    this.resetRun();
    this.setStatus("playing");
    this.startWave(1);
    this.tutorialT = this.isTouch ? 7.5 : 0;
    if (this.duo) this.banner("DUO", "P1 WASD · P2 FLÈCHES", COL.lime, 2);
    this.banner("GO!", "SPRAY 'EM ALL", COL.player, 1.1);
    this.sfx.wave();
    this.addTrauma(0.3);
    this.loopStart();
  }

  pause() {
    if (this.status !== "playing") return;
    this.setStatus("paused");
    this.sfx.ui();
  }
  resume() {
    if (this.status !== "paused") return;
    this.last = 0;
    this.setStatus("playing");
    this.sfx.ui();
  }
  togglePause() {
    if (this.status === "playing") this.pause();
    else if (this.status === "paused") this.resume();
  }
  toMenu() {
    this.setStatus("menu");
    this.dying = 0;
    this.trauma = 0;
    this.flashAmt = 0;
    this.hitstop = 0;
    this.spawnMenuDemo();
  }

  private setStatus(s: Status) {
    this.status = s;
    this.cb.onStatus(s);
  }

  private loopStart() {
    this.last = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private spawnMenuDemo() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.parts.length = 0;
    this.telegraphs.length = 0;
    this.banners.length = 0;
    this.pending.length = 0;
    this.between = 0;
    this.wave = 0;
    this.time = 0;
    this.clearPaint();
    const types: EType[] = ["grunt", "rusher", "sniper", "grunt", "rusher"];
    types.forEach((t) => this.enemies.push(this.makeEnemy(t, rnd(120, this.W - 120), rnd(120, this.H - 120))));
    this.p.x = this.W / 2;
    this.p.y = this.H / 2;
  }

  /* ---------------- waves ---------------- */

  private startWave(n: number) {
    this.wave = n;
    const list: EType[] = [];
    const budget = 3 + Math.floor(n * 1.7);
    for (let i = 0; i < budget; i++) {
      const r = Math.random();
      if (n >= 3 && r < 0.2) list.push("sniper");
      else if (n >= 2 && r < 0.55) list.push("rusher");
      else list.push("grunt");
    }
    if (n % 5 === 0) {
      list.unshift("boss");
      this.banner("BOSS INCOMING", "HEAVY PAINT PRESSURE", COL.boss, 2);
      this.sfx.boss();
      this.addTrauma(0.6);
    } else {
      this.banner("WAVE " + n, n === 1 ? "SPRAY THEM TO BITS" : "THEY KEEP COMING", COL.chalk, 1.25);
      this.sfx.wave();
    }
    this.pending = list;
    this.maxAlive = clamp(5 + Math.floor(n * 1.2), 5, this.isTouch ? 9 : 15);
    this.spawnT = n === 1 ? 0.45 : 0.7;
  }

  private makeEnemy(type: EType, x: number, y: number): Enemy {
    const d = ENEMY_DEF[type];
    const scale = 1 + Math.min(0.55, (this.wave - 1) * 0.045);
    return {
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      r: d.r,
      hp: d.hp * scale,
      maxHp: d.hp * scale,
      angle: rnd(TAU),
      speed: d.speed * (1 + Math.min(0.35, (this.wave - 1) * 0.03)),
      fireT: rnd(0.6, 1.8),
      charge: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: rnd(1, 2.6),
      lungeT: 0,
      coolT: 0,
      flash: 0,
      wobble: rnd(TAU),
      volley: 0,
      stormT: 4,
      born: 0.35,
    };
  }

  private spawnPoint() {
    const m = 70;
    for (let tries = 0; tries < 40; tries++) {
      const side = (Math.random() * 4) | 0;
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = rnd(m, this.W - m);
        y = m;
      } else if (side === 1) {
        x = this.W - m;
        y = rnd(m, this.H - m);
      } else if (side === 2) {
        x = rnd(m, this.W - m);
        y = this.H - m;
      } else {
        x = m;
        y = rnd(m, this.H - m);
      }
      if (Math.hypot(x - this.p.x, y - this.p.y) < 180) continue;
      if (!this.inBunkers(x, y, 30)) return { x, y };
    }
    return { x: this.W / 2, y: m };
  }

  private inBunkers(x: number, y: number, pad: number) {
    for (const b of this.bunkers) {
      if (Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(y - b.y) <= b.h / 2 + pad) return true;
    }
    return false;
  }

  /* ---------------- shooting ---------------- */

  private startReload(pl: Pilot) {
    if (pl.dead || pl.reload > 0 || pl.ammo >= pl.mag) return;
    if (pl.i === this.localIdx) this.queued.reload = true;
    pl.reload = 0.95;
    pl.reloadFrom = pl.ammo;
    this.sfx.reloadOut();
  }

  private tryDash(pl: Pilot) {
    if (this.status !== "playing" || this.dying > 0 || pl.dead) return;
    if (pl.i === this.localIdx) this.queued.dash = true;
    if (pl.dashCd > 0 || pl.dashT > 0) return;
    let dx = this.axisX(pl.i);
    let dy = this.axisY(pl.i);
    if (dx === 0 && dy === 0) {
      dx = Math.cos(pl.angle);
      dy = Math.sin(pl.angle);
    }
    const l = Math.hypot(dx, dy) || 1;
    pl.dashX = dx / l;
    pl.dashY = dy / l;
    pl.dashT = 0.17;
    pl.dashCd = 1.05;
    pl.invuln = Math.max(pl.invuln, 0.34);
    this.addTrauma(0.24);
    this.sfx.dash();
    this.buzz(14);
    this.ring(pl.x, pl.y, pl.i === 0 ? COL.player : COL.lime, 46, 0.28);
  }

  private fire(pl: Pilot) {
    const p = pl;
    const col = p.i === 0 ? COL.player : COL.lime;
    if (p.dead || p.reload > 0 || p.fireT > 0 || p.dashT > 0) return;
    if (p.ammo <= 0) {
      this.startReload(p);
      return;
    }
    p.ammo--;
    p.fireT = p.rapidT > 0 ? 0.062 : 0.108;
    p.bloom = Math.min(0.15, p.bloom + 0.035);
    const n = p.tripleT > 0 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - 1) * 0.13;
      const a = p.angle + off + rnd(-p.bloom, p.bloom);
      const spd = 700;
      this.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * spd + p.vx * 0.22,
        vy: Math.sin(a) * spd + p.vy * 0.22,
        life: 1.25,
        r: 5,
        dmg: 30,
        color: col,
        foe: false,
        owner: p.i,
        bounce: p.ricochetT > 0 ? 3 : 0,
        boom: p.boomT > 0,
      });
    }
    this.shots += n;
    p.vx -= Math.cos(p.angle) * 42;
    p.vy -= Math.sin(p.angle) * 42;
    this.spray(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, col, 4, 130, 0.9, p.angle);
    this.part({
      kind: 2,
      x: p.x + Math.cos(p.angle) * 24,
      y: p.y + Math.sin(p.angle) * 24,
      life: 0.22,
      max: 0.22,
      size: 14,
      color: "#ffffff",
    });
    this.addTrauma(0.075);
    this.sfx.shoot();
    if (p.ammo === 0) this.startReload(p);
  }

  private enemyShoot(e: Enemy, spread: number, count: number, speed: number, dmg: number) {
    for (let i = 0; i < count; i++) {
      const a = e.angle + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread) + rnd(-0.04, 0.04);
      this.bullets.push({
        x: e.x + Math.cos(a) * (e.r + 8),
        y: e.y + Math.sin(a) * (e.r + 8),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 2,
        r: 5.5,
        dmg,
        color: ENEMY_DEF[e.type].color,
        foe: true,
        owner: -1,
        bounce: 0,
        boom: false,
      });
    }
    this.spray(e.x + Math.cos(e.angle) * (e.r + 8), e.y + Math.sin(e.angle) * (e.r + 8), ENEMY_DEF[e.type].color, 3, 110, 0.8, e.angle);
    if (this.status === "playing") this.sfx.enemyShoot();
  }

  /* ---------------- collisions ---------------- */

  private collideRect(o: { x: number; y: number; vx: number; vy: number }, r: number) {
    for (const b of this.bunkers) {
      const hw = b.w / 2;
      const hh = b.h / 2;
      const cx = clamp(o.x, b.x - hw, b.x + hw);
      const cy = clamp(o.y, b.y - hh, b.y + hh);
      let dx = o.x - cx;
      let dy = o.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          o.x = cx + (dx / d) * r;
          o.y = cy + (dy / d) * r;
          const nX = dx / d;
          const nY = dy / d;
          const dot = o.vx * nX + o.vy * nY;
          if (dot < 0) {
            o.vx -= nX * dot;
            o.vy -= nY * dot;
          }
        } else {
          o.y = b.y - hh - r;
          o.vy = -Math.abs(o.vy);
        }
      }
    }
    if (o.x < this.mL) {
      o.x = this.mL;
      o.vx = Math.max(0, o.vx);
    }
    if (o.x > this.W - this.mR) {
      o.x = this.W - this.mR;
      o.vx = Math.min(0, o.vx);
    }
    if (o.y < this.mT) {
      o.y = this.mT;
      o.vy = Math.max(0, o.vy);
    }
    if (o.y > this.H - this.mB) {
      o.y = this.H - this.mB;
      o.vy = Math.min(0, o.vy);
    }
  }

  private hitsRect(x: number, y: number, b: { x: number; y: number; w: number; h: number }) {
    return Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2;
  }

  private los(a: { x: number; y: number }, b: { x: number; y: number }) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.min(30, Math.max(4, (d / 26) | 0));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = lerp(a.x, b.x, t);
      const y = lerp(a.y, b.y, t);
      for (const bl of this.bunkers) if (this.hitsRect(x, y, bl)) return false;
    }
    return true;
  }

  /* ---------------- update ---------------- */

  private axisX(idx = 0) {
    let a = 0;
    if (idx === 1) {
      if (this.keys.has("ArrowRight")) a += 1;
      if (this.keys.has("ArrowLeft")) a -= 1;
      return clamp(a, -1, 1);
    }
    if (this.keys.has("KeyD")) a += 1;
    if (this.keys.has("KeyA")) a -= 1;
    if (!this.duo) {
      if (this.keys.has("ArrowRight")) a += 1;
      if (this.keys.has("ArrowLeft")) a -= 1;
    }
    if (this.stickMove.active) a += this.stickMove.dx;
    return clamp(a, -1, 1);
  }
  private axisY(idx = 0) {
    let a = 0;
    if (idx === 1) {
      if (this.keys.has("ArrowDown")) a += 1;
      if (this.keys.has("ArrowUp")) a -= 1;
      return clamp(a, -1, 1);
    }
    if (this.keys.has("KeyS")) a += 1;
    if (this.keys.has("KeyW")) a -= 1;
    if (!this.duo) {
      if (this.keys.has("ArrowDown")) a += 1;
      if (this.keys.has("ArrowUp")) a -= 1;
    }
    if (this.stickMove.active) a += this.stickMove.dy;
    return clamp(a, -1, 1);
  }
  private firing(idx = 0) {
    if (idx === 1) {
      return (
        this.keys.has("Enter") ||
        this.keys.has("NumpadEnter") ||
        this.keys.has("Numpad0") ||
        this.keys.has("Slash")
      );
    }
    return (
      this.mouse.down ||
      this.keys.has("Space") ||
      this.keys.has("KeyJ") ||
      this.btn.fire.id !== -1 ||
      (this.stickAim.active && this.stickAim.mag > 0.4)
    );
  }

  /** visée assistée (pouce / pilote 2) : la menace la plus proche gagne */
  private autoAim(p: Pilot, fallback: number | null) {
    const t = this.nearestPilot === null ? null : null;
    void t;
    let best: Enemy | null = null;
    let bd = 1e9;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best && bd < 660) return Math.atan2(best.y - p.y, best.x - p.x);
    return fallback ?? p.angle;
  }

  /** retour haptique (sans-op si non supporté / coupé) */
  private buzz(ms: number | number[]) {
    if (!this.vibe) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* noop */
    }
  }
  toggleVibe() {
    this.vibe = !this.vibe;
    localStorage.setItem("pb.vibe", this.vibe ? "1" : "0");
    if (this.vibe) this.buzz(24);
    return this.vibe;
  }
  get vibeOn() {
    return this.vibe;
  }
  get touchMode() {
    return this.isTouch;
  }

  private frame = (ts: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    const now = ts / 1000;
    let dt = this.last ? now - this.last : 1 / 60;
    this.last = now;
    if (dt > 1 / 15) dt = 1 / 15;
    const running = this.status === "playing" || this.status === "menu";
    if (this.hitstop > 0) this.hitstop -= dt;
    if (running) {
      const scale = this.dying > 0 ? 0.3 : 1;
      this.update(this.hitstop > 0 ? 0 : dt * scale, this.status === "menu");
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.85);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 3.2);
    for (const k of ["fire", "dash", "reload"] as const) {
      const bb = this.btn[k];
      bb.press = Math.max(0, bb.press - dt);
    }
    this.tutorialT = Math.max(0, this.tutorialT - dt);
    this.frameCount++;
    if (this.frameCount % 8 === 0) this.checkSize();
    const sh = this.trauma * this.trauma * 20;
    this.shakeX = Math.cos(now * 47.3) * sh;
    this.shakeY = Math.sin(now * 38.9) * sh;
    this.draw();
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.emitHud();
    }
  };

  private emitHud() {
    const combo = this.comboMult();
    this.cb.onHud({
      hp: Math.max(0, this.p.hp),
      maxHp: this.p.maxHp,
      score: Math.floor(this.score),
      wave: this.wave,
      combo,
      comboPct: this.comboT > 0 ? clamp(this.comboT / 3.4, 0, 1) : 0,
      enemies: this.enemies.length + this.pending.length + this.telegraphs.length,
      coverage: this.coverage,
      ammo: this.p.ammo,
      mag: this.p.mag,
      time: this.time,
      dashPct: 1 - clamp(this.p.dashCd / 1.05, 0, 1),
      powerName: this.p.tripleT > 0 ? "TRIPLE STREAM" : this.p.rapidT > 0 ? "OVERCLOCK" : "",
      powerPct: Math.max(this.p.tripleT / 9, this.p.rapidT / 5),
      duo: this.duo,
      shield: this.p.shield,
      p2: this.p2
        ? {
            shield: this.p2.shield,
            hp: Math.max(0, this.p2.hp),
            maxHp: this.p2.maxHp,
            ammo: this.p2.ammo,
            mag: this.p2.mag,
            dead: this.p2.dead,
          }
        : null,
    });
  }

  private comboMult() {
    let m = 1;
    for (let i = 0; i < COMBO_STEPS.length; i++) if (this.streak >= COMBO_STEPS[i]) m = 2 + i;
    return m;
  }

  private update(dt: number, demo: boolean) {
    this.time += dt;
    if (!demo) {
      for (const pl of this.pilots()) this.updatePilot(pl, dt);
      this.updateWaves(dt);
      this.updatePickups(dt);
      this.comboT = Math.max(0, this.comboT - dt);
      if (this.comboT === 0 && this.streak > 0) this.streak = 0;
    } else {
      this.ghost.a += dt * 0.75;
      const R = Math.min(this.W, this.H) * 0.3;
      this.ghost.x = this.W / 2 + Math.cos(this.ghost.a) * R * 1.35;
      this.ghost.y = this.H / 2 + Math.sin(this.ghost.a * 1.3) * R;
    }
    this.updateEnemies(dt, demo);
    this.updateBullets(dt);
    this.updateRollers(dt);
    this.updateParticles(dt);
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.t -= dt;
      if (t.t <= 0) {
        const e = this.makeEnemy(t.type, t.x, t.y);
        e.born = 0.3;
        this.enemies.push(e);
        this.telegraphs.splice(i, 1);
        this.splat(t.x, t.y, ENEMY_DEF[t.type].color, 96, 0.9);
        this.spray(t.x, t.y, ENEMY_DEF[t.type].color, 16, 220);
        this.ring(t.x, t.y, ENEMY_DEF[t.type].color, 74, 0.36);
        this.addTrauma(0.18);
      }
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].t += dt;
      if (this.banners[i].t > this.banners[i].dur) this.banners.splice(i, 1);
    }
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.gameOver();
    }
  }

  private updateWaves(dt: number) {
    if (this.dying > 0) return;
    if (this.between > 0) {
      this.between -= dt;
      if (this.between <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.pending.length > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.enemies.length + this.telegraphs.length < this.maxAlive) {
        const type = this.pending.shift()!;
        const pt = this.spawnPoint();
        this.telegraphs.push({ x: pt.x, y: pt.y, t: type === "boss" ? 1.3 : 0.8, dur: 0.8, type });
        this.spawnT = clamp(1.15 - this.wave * 0.045, 0.35, 1.15) * rnd(0.7, 1.3);
      }
    } else if (this.enemies.length === 0) {
      const cov = this.coverage;
      const bonus = 220 * this.wave + Math.round(cov * 1400);
      this.score += bonus;
      for (const pl of this.pilots()) {
        if (pl.dead) {
          pl.dead = false;
          pl.hp = 3;
          pl.invuln = 2.4;
          pl.x = this.W / 2;
          pl.y = this.H * 0.72;
          this.ring(pl.x, pl.y, pl.i === 0 ? COL.player : COL.lime, 90, 0.5);
          this.popText(pl.x, pl.y - 30, "PILOTE " + (pl.i + 1) + " REVIVE!", COL.lime, 22);
        } else {
          pl.hp = Math.min(pl.maxHp, pl.hp + 1);
        }
        pl.ammo = pl.mag;
        pl.reload = 0;
      }
      this.banner("WAVE " + this.wave + " CLEAR", "+" + bonus + "  •  COURT " + Math.round(cov * 100) + "%", COL.boss, 1.9);
      this.sfx.wave();
      this.flash(COL.boss, 0.22);
      this.between = 2.4;
    }
  }

  private updatePilot(pl: Pilot, dt: number) {
    const p = pl;
    const col = p.i === 0 ? COL.player : COL.lime;
    const net = this.netPilot && this.netPilot.idx === pl.i ? this.netPilot : null;
    if (net && net.input === null) return; // pilotade à distance : piloté par snapshots
    const rem = net ? net.input : null;
    const c = pl.i === this.localIdx ? 0 : 1;
    if (p.dead) return;
    if (this.dying > 0) {
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return;
    }
    const ax = rem ? rem.mx : this.axisX(c);
    const ay = rem ? rem.my : this.axisY(c);
    const mag = Math.hypot(ax, ay);

    // --- visée
    if (rem) {
      p.angle = rem.aim;
    } else if (c === 0 && this.stickAim.active && this.stickAim.mag > 0.12) {
      let want = Math.atan2(this.stickAim.dy, this.stickAim.dx);
      if (this.isTouch) {
        const t = this.nearestPilot(p.x, p.y);
        void t;
        let best: Enemy | null = null;
        let bd = 1e9;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best && bd < 560) {
          const ea = Math.atan2(best.y - p.y, best.x - p.x);
          let diff = ea - want;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          if (Math.abs(diff) < 0.3) want += diff * 0.6;
        }
      }
      p.angle = want;
    } else if (c === 0 && this.mouse.used && !this.duo) {
      p.angle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
    } else if (c === 0 && this.mouse.used && this.duo && this.mouse.down) {
      p.angle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
    } else {
      p.angle = this.autoAim(p, mag > 0.15 ? Math.atan2(ay, ax) : null);
    }

    // --- dash / déplacement
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashX * 640;
      p.vy = p.dashY * 640;
      if (Math.random() < 0.9)
        this.part({
          kind: 0,
          x: p.x + rnd(-6, 6),
          y: p.y + rnd(-6, 6),
          vx: -p.vx * 0.08,
          vy: -p.vy * 0.08,
          life: 0.3,
          max: 0.3,
          size: rnd(3, 7),
          color: col,
          paint: 1,
        });
    } else {
      const spd = 252 * (p.reload > 0 ? 0.86 : 1);
      const tx = mag > 0.02 ? (ax / Math.max(mag, 1)) * spd : 0;
      const ty = mag > 0.02 ? (ay / Math.max(mag, 1)) * spd : 0;
      const k = mag > 0.02 ? 1 - Math.exp(-16 * dt) : 1 - Math.exp(-11 * dt);
      p.vx = lerp(p.vx, tx, k);
      p.vy = lerp(p.vy, ty, k);
    }
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.step += Math.hypot(p.vx, p.vy) * dt * 0.055;
    this.collideRect(p, p.r);
    if (mag > 0.4 && p.dashT <= 0 && Math.random() < dt * 12) {
      this.part({
        kind: 0,
        x: p.x - Math.cos(p.angle) * 8,
        y: p.y + 8,
        vx: rnd(-16, 16),
        vy: rnd(-8, 16),
        life: 0.2,
        max: 0.2,
        size: rnd(1.5, 3),
        color: col,
      });
    }

    // --- arme
    p.fireT -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      const prog = clamp(1 - p.reload / 0.95, 0, 1);
      p.ammo = Math.min(p.mag, p.reloadFrom + Math.round((p.mag - p.reloadFrom) * prog));
      if (p.reload <= 0) {
        p.reload = 0;
        p.ammo = p.mag;
        this.sfx.reloadIn();
        this.ring(p.x, p.y, col, 34, 0.22);
      }
    }
    p.bloom = Math.max(0, p.bloom - dt * 0.28);
    if (rem ? rem.fire : this.firing(c)) this.fire(p);
    if (rem && rem.dash) {
      rem.dash = false;
      this.tryDash(pl);
    }
    if (rem && rem.reload) {
      rem.reload = false;
      this.startReload(pl);
    }
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 3.4);
    p.tripleT = Math.max(0, p.tripleT - dt);
    p.rapidT = Math.max(0, p.rapidT - dt);
    p.ricochetT = Math.max(0, p.ricochetT - dt);
    p.boomT = Math.max(0, p.boomT - dt);
  }

  private hurtPilot(p: Pilot, amount: number, x: number, y: number, color: string) {
    if (p.dead || p.invuln > 0 || this.dying > 0 || this.status !== "playing") return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.5;
      p.hitFlash = 1;
      this.ring(p.x, p.y, "#7ef4ff", 78, 0.32);
      this.spray(p.x, p.y, "#7ef4ff", 12, 220);
      this.popText(p.x, p.y - 26, "BOUCLIER !", "#7ef4ff", 19);
      this.addTrauma(0.26);
      this.flash("#7ef4ff", 0.2);
      this.sfx.shield();
      this.buzz(16);
      return;
    }
    p.hp -= amount;
    p.invuln = 1.15;
    p.hitFlash = 1;
    this.streak = 0;
    this.comboT = 0;
    const a = Math.atan2(p.y - y, p.x - x);
    p.vx += Math.cos(a) * 210;
    p.vy += Math.sin(a) * 210;
    this.splat(p.x + Math.cos(a) * -6, p.y + Math.sin(a) * -6, color, 74, 0.95);
    this.spray(p.x, p.y, color, 18, 250);
    this.addTrauma(0.62);
    this.flash(color, 0.42);
    this.hitstop = 0.05;
    this.sfx.hurt();
    this.buzz([0, 30, 24, 46]);
    this.popText(p.x, p.y - 26, "SPLAT!", color, 22);
    if (p.hp > 0) return;
    p.hp = 0;
    p.dead = true;
    this.spray(p.x, p.y, color, 46, 420);
    this.splat(p.x, p.y, color, 150, 1);
    this.splat(p.x + rnd(-40, 40), p.y + rnd(-40, 40), color, 90, 0.9);
    this.ring(p.x, p.y, "#ffffff", 150, 0.5);
    for (let i = 0; i < 10; i++)
      this.part({
        kind: 1,
        x: p.x,
        y: p.y,
        vx: rnd(-320, 320),
        vy: rnd(-320, 320),
        life: rnd(0.3, 0.7),
        max: 0.7,
        size: rnd(2, 5),
        color: p.i === 0 ? COL.player : COL.lime,
      });
    this.addTrauma(0.9);
    if (this.duo && !this.allDown()) {
      // en duo, un pilote tombe mais la partie continue : revive en fin de vague
      this.banner("PILOTE " + (p.i + 1) + " HORS JEU", "REVIVE À LA PROCHAINE VAGUE", COL.rusher, 1.8);
      this.flash(color, 0.6);
      this.buzz([0, 40, 30, 60]);
      return;
    }
    this.dying = 0.85;
    this.addTrauma(1);
    this.flash("#ffffff", 0.9);
    this.sfx.over();
    this.buzz([0, 90, 50, 180]);
  }

  private updateEnemies(dt: number, demo: boolean) {
    const ghost = this.ghost;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const tp = demo ? null : this.nearestPilot(e.x, e.y);
      const target = tp ? tp.p : ghost;
      e.born = Math.max(0, e.born - dt);
      e.flash = Math.max(0, e.flash - dt * 4);
      e.wobble += dt * (e.type === "rusher" ? 16 : 7);
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ax = dx / d;
      const ay = dy / d;
      const want = e.type === "rusher" ? 0 : e.type === "sniper" ? 330 : e.type === "boss" ? 250 : 235;
      e.angle = lerp(e.angle, Math.atan2(dy, dx), 1 - Math.exp(-9 * dt));
      let move = 0;
      if (d > want + 30) move = 1;
      else if (d < want - 40) move = -0.9;
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = rnd(0.9, 2.4);
        e.strafe *= -1;
      }
      const see = this.los(e, target);
      if (!see && d > 130) move = 1;
      const strafeSpd = e.type === "rusher" ? 0.35 : 0.75;
      let tvx = (ax * move + -ay * e.strafe * strafeSpd) * e.speed;
      let tvy = (ay * move + ax * e.strafe * strafeSpd) * e.speed;
      if (e.type === "rusher") {
        tvx = ax * e.speed;
        tvy = ay * e.speed;
        e.lungeT -= dt;
        if (d < 150 && e.lungeT <= -0.6) {
          e.lungeT = 0.28;
          e.coolT = 0.4;
        }
        if (e.lungeT > 0) {
          tvx *= 2.1;
          tvy *= 2.1;
        }
      }
      if (tp && e.type === "rusher" && d < e.r + tp.p.r + 6 && e.coolT <= 0) {
        e.coolT = 1.1;
        this.hurtPilot(tp.p, 1, e.x, e.y, COL.rusher);
        tvx = -ax * 220;
        tvy = -ay * 220;
      }
      e.coolT -= dt;
      const k = 1 - Math.exp(-(e.type === "rusher" ? 7 : 5) * dt);
      e.vx = lerp(e.vx, tvx, k);
      e.vy = lerp(e.vy, tvy, k);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      this.collideRect(e, e.r);

      // separation
      for (let j = i - 1; j >= 0; j--) {
        const o = this.enemies[j];
        const ox = o.x - e.x;
        const oy = o.y - e.y;
        const od = Math.hypot(ox, oy);
        const min = e.r + o.r + 4;
        if (od > 0.001 && od < min) {
          const push = ((min - od) / min) * 60 * dt * 8;
          e.x -= (ox / od) * push;
          e.y -= (oy / od) * push;
          o.x += (ox / od) * push;
          o.y += (oy / od) * push;
        }
      }

      // shooting
      if (e.born <= 0) {
        if (e.type === "sniper") {
          if (e.charge > 0) {
            e.charge -= dt;
            if (e.charge <= 0 && see) {
              this.enemyShoot(e, 0, 1, 900, 1);
              this.spray(e.x, e.y, COL.sniper, 6, 200, 0.7, e.angle);
            }
          } else {
            e.fireT -= dt;
            if (e.fireT <= 0 && see && d < 620) {
              e.charge = 0.62;
              e.fireT = rnd(1.5, 2.4);
            }
          }
        } else if (e.type === "boss") {
          e.stormT -= dt;
          if (e.volley > 0) {
            e.coolT -= dt;
            if (e.coolT <= 0) {
              e.volley--;
              e.coolT = 0.12;
              this.enemyShoot(e, 0.62, 5, 430, 1);
              this.addTrauma(0.1);
            }
          } else if (e.stormT <= 0 && see) {
            e.stormT = rnd(4.6, 6.4);
            e.volley = 3;
            e.coolT = 0;
          } else {
            e.fireT -= dt;
            if (e.fireT <= 0 && see) {
              e.fireT = rnd(1.5, 2.3);
              this.enemyShoot(e, 0, 1, 430, 1);
            }
          }
        } else if (e.type !== "rusher") {
          e.fireT -= dt;
          if (e.fireT <= 0 && (see || d < 200)) {
            e.fireT = clamp(rnd(1.3, 2.3) - this.wave * 0.03, 0.6, 2.3);
            this.enemyShoot(e, 0, 1, 430 + this.wave * 6, 1);
          }
        }
      }
    }
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      const steps = 2;
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (b.x < 4 || b.y < 4 || b.x > this.W - 4 || b.y > this.H - 4) {
          if (b.bounce > 0 && !b.foe) {
            b.bounce--;
            if (b.x < 4 || b.x > this.W - 4) b.vx = -b.vx;
            if (b.y < 4 || b.y > this.H - 4) b.vy = -b.vy;
            b.x = clamp(b.x, 6, this.W - 6);
            b.y = clamp(b.y, 6, this.H - 6);
            this.spray(b.x, b.y, b.color, 5, 140, 1.6, Math.atan2(b.vy, b.vx));
            this.sfx.ricochet();
          } else {
            gone = true;
            break;
          }
        }
        for (const bl of this.bunkers) {
          if (this.hitsRect(b.x, b.y, bl)) {
            if (b.bounce > 0 && !b.foe) {
              b.bounce--;
              const dx = Math.abs(b.x - bl.x) / (bl.w / 2);
              const dy = Math.abs(b.y - bl.y) / (bl.h / 2);
              if (dx > dy) b.vx = -b.vx;
              else b.vy = -b.vy;
              b.x += b.vx * 0.012;
              b.y += b.vy * 0.012;
              this.spray(b.x, b.y, b.color, 6, 160, 1.6, Math.atan2(b.vy, b.vx));
              this.sfx.ricochet();
            } else {
              gone = true;
              this.spray(b.x, b.y, b.color, 5, 130, 1.4, Math.atan2(-b.vy, -b.vx));
            }
            break;
          }
        }
        if (gone) break;
        if (b.foe) {
          if (this.status === "playing" && this.dying <= 0) {
            for (const pl of this.pilots()) {
              if (pl.dead) continue;
              const dd = Math.hypot(b.x - pl.x, b.y - pl.y);
              if (dd < pl.r + b.r) {
                this.hurtPilot(pl, 1, b.x - b.vx * 0.01, b.y - b.vy * 0.01, b.color);
                gone = true;
                break;
              }
            }
          }
        } else {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
              if (b.boom && !b.foe) this.explode(b.x, b.y, b.color, b.owner, 118, b.dmg);
              else this.damageEnemy(e, j, b.dmg, b.x, b.y, b.color, b.owner);
              gone = true;
              break;
            }
          }
        }
      }
      if (gone || b.life <= 0) {
        if (!gone) this.splat(b.x, b.y, b.color, b.foe ? 26 : 34, 0.8);
        else this.splat(b.x, b.y, b.color, 30, 0.75);
        this.spray(b.x, b.y, b.color, 3, 90, 1.2, Math.atan2(-b.vy, -b.vx));
        this.bullets.splice(i, 1);
        if (this.bullets.length > 260) this.bullets.shift();
      }
    }
  }

  /** Explosion de peinture : dégâts de zone + grand éclat. */
  private explode(x: number, y: number, color: string, owner: number, radius: number, dmg: number) {
    this.ring(x, y, color, radius * 1.7, 0.42);
    this.splat(x, y, color, radius * 1.5, 1);
    this.splat(x + rnd(-30, 30), y + rnd(-30, 30), color, radius * 0.8, 0.9);
    this.spray(x, y, color, 26, 340);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - x, e.y - y) < radius + e.r) this.damageEnemy(e, i, dmg, x, y, color, owner);
    }
    this.addTrauma(0.45);
    this.hitstop = Math.max(this.hitstop, 0.045);
    this.flash(color, 0.18);
    this.sfx.boom();
  }

  private damageEnemy(e: Enemy, idx: number, dmg: number, hx: number, hy: number, color: string, owner = 0) {
    if (owner >= 0) this.hitsBy[owner]++;
    e.hp -= dmg;
    e.flash = 1;
    const a = Math.atan2(e.y - hy, e.x - hx);
    e.vx += Math.cos(a) * (e.type === "boss" ? 40 : 150);
    e.vy += Math.sin(a) * (e.type === "boss" ? 40 : 150);
    this.splat(hx, hy, color, e.type === "boss" ? 44 : 34, 0.85);
    this.spray(hx, hy, color, 6, 170, 1.5, a + Math.PI);
    this.sfx.hit();
    this.addTrauma(0.05);
    if (e.hp <= 0) this.killEnemy(e, idx, color, owner);
  }

  private killEnemy(e: Enemy, idx: number, color: string, owner = 0) {
    this.enemies.splice(idx, 1);
    const def = ENEMY_DEF[e.type];
    const prevMult = this.comboMult();
    this.kills++;
    if (owner >= 0) this.killsBy[owner]++;
    this.streak++;
    this.maxCombo = Math.max(this.maxCombo, this.streak);
    this.comboT = 3.4;
    const mult = this.comboMult();
    if (mult > prevMult) {
      this.banner("COMBO x" + mult, this.streak + " CLEAN SPLATS", "#b9ff33", 1.1);
      this.flash("#b9ff33", 0.2);
      this.addTrauma(0.25);
    }
    const gain = Math.round(def.score * mult * (e.type === "boss" ? 1 : 1));
    this.score += gain;
    this.sfx.kill();
    if (mult > 1) {
      this.sfx.combo(mult);
      this.popText(e.x, e.y - 40, "x" + mult, COL.boss, 18);
    }
    this.popText(e.x, e.y - 16, "+" + gain, color, e.type === "boss" ? 30 : 20);
    this.splat(e.x, e.y, def.color, e.type === "boss" ? 190 : 104, 1);
    this.splat(e.x + rnd(-30, 30), e.y + rnd(-30, 30), color, e.type === "boss" ? 120 : 62, 0.9);
    this.spray(e.x, e.y, def.color, e.type === "boss" ? 60 : 26, e.type === "boss" ? 460 : 300);
    this.ring(e.x, e.y, def.color, e.type === "boss" ? 190 : 70, e.type === "boss" ? 0.6 : 0.34);
    for (let i = 0; i < (e.type === "boss" ? 14 : 6); i++)
      this.part({
        kind: 1,
        x: e.x,
        y: e.y,
        vx: rnd(-1, 1) * 320,
        vy: rnd(-1, 1) * 320,
        life: rnd(0.2, 0.5),
        max: 0.5,
        size: rnd(2, 5),
        color: "#ffffff",
      });
    this.addTrauma(e.type === "boss" ? 0.95 : 0.3);
    this.buzz(e.type === "boss" ? [0, 55, 40, 90] : 9);
    this.hitstop = Math.max(this.hitstop, e.type === "boss" ? 0.11 : 0.045);
    this.flash(def.color, e.type === "boss" ? 0.5 : 0.12);
    if (e.type === "boss") {
      this.banner("BOSS SPLATTED", "+" + gain, COL.boss, 1.6);
      this.shakeBig();
    }
    // drops
    const roll = Math.random();
    const chance = e.type === "boss" ? 1 : 0.24;
    if (roll < chance) {
      const kind = e.type === "boss" ? 3 + Math.floor(Math.random() * 4) : rollPickup();
      this.pickups.push({ x: e.x, y: e.y, vx: rnd(-40, 40), vy: rnd(-40, 40), t: 13, kind });
    }
  }

  private shakeBig() {
    this.addTrauma(0.4);
    for (let i = 0; i < 20; i++)
      this.part({ kind: 0, x: rnd(this.W), y: rnd(this.H), vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.4, max: 0.4, size: rnd(2, 4), color: COL.boss });
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i];
      q.t -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - 3 * dt;
      q.vy *= 1 - 3 * dt;
      this.collideRect(q, 14);
      if (q.t <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      const tp = this.nearestPilot(q.x, q.y);
      if (tp && Math.hypot(q.x - tp.p.x, q.y - tp.p.y) < tp.p.r + 18) {
        this.pickups.splice(i, 1);
        this.sfx.pickup();
        this.ring(q.x, q.y, (PICKUPS[q.kind] ?? PICKUPS[0]).color, 54, 0.3);
        const def = PICKUPS[q.kind] ?? PICKUPS[0];
        if (q.kind === 1) {
          tp.p.hp = Math.min(tp.p.maxHp, tp.p.hp + 2);
          this.popText(q.x, q.y - 10, "+PAINT", def.color, 20);
        } else if (q.kind === 0) {
          tp.p.ammo = tp.p.mag;
          tp.p.reload = 0;
          tp.p.rapidT = 5;
          this.popText(q.x, q.y - 10, "OVERCLOCK", def.color, 20);
        } else if (q.kind === 2) {
          tp.p.tripleT = 9;
          this.popText(q.x, q.y - 10, "TRIPLE STREAM", def.color, 20);
        } else if (q.kind === 3) {
          tp.p.shield = 2;
          tp.p.invuln = Math.max(tp.p.invuln, 0.6);
          this.ring(tp.p.x, tp.p.y, def.color, 90, 0.42);
          this.popText(q.x, q.y - 10, "BOUCLIER", def.color, 20);
        } else if (q.kind === 4) {
          tp.p.ricochetT = 12;
          this.popText(q.x, q.y - 10, "RICOCHET", def.color, 20);
        } else if (q.kind === 5) {
          tp.p.boomT = 9;
          this.popText(q.x, q.y - 10, "BILLE EXPLOSIVE", def.color, 20);
        } else {
          this.spawnRoller(tp.p);
          this.popText(q.x, q.y - 10, "ROULEAU !", def.color, 22);
        }
        this.score += 60;
        this.flash("#ffffff", 0.14);
      }
    }
  }

  /** Rouleau de peinture : avance, peint large, écrase ce qu'il traverse. */
  private spawnRoller(p: Pilot) {
    this.rollers.push({
      x: p.x + Math.cos(p.angle) * 30,
      y: p.y + Math.sin(p.angle) * 30,
      a: p.angle,
      t: 0,
      life: 2.4,
      speed: 430,
      w: 78,
      hit: new Set<Enemy>(),
    });
    this.addTrauma(0.3);
    this.sfx.boss();
    this.buzz(28);
  }

  private updateRollers(dt: number) {
    for (let i = this.rollers.length - 1; i >= 0; i--) {
      const r = this.rollers[i];
      r.t += dt;
      r.x += Math.cos(r.a) * r.speed * dt;
      r.y += Math.sin(r.a) * r.speed * dt;
      this.splat(r.x + rnd(-r.w / 2, r.w / 2), r.y + rnd(-r.w / 2, r.w / 2), COL.grunt, 56, 0.7);
      for (const e of this.enemies) {
        if (r.hit.has(e)) continue;
        if (Math.hypot(e.x - r.x, e.y - r.y) < r.w * 0.62 + e.r) {
          r.hit.add(e);
          this.damageEnemy(e, this.enemies.indexOf(e), 80, r.x, r.y, COL.grunt, 0);
          this.spray(e.x, e.y, COL.grunt, 12, 260);
        }
      }
      const out = r.x < -40 || r.y < -40 || r.x > this.W + 40 || r.y > this.H + 40;
      // le rouleau passe PAR-DESSUS les bunkers : il ne s'arrete qu'aux murs
      if (r.t > r.life || out) {
        this.splat(r.x, r.y, COL.grunt, 120, 1);
        this.ring(r.x, r.y, COL.grunt, 90, 0.35);
        this.spray(r.x, r.y, COL.grunt, 16, 240);
        this.rollers.splice(i, 1);
      }
    }
  }

  private drawRollers(ctx: CanvasRenderingContext2D) {
    for (const r of this.rollers) {
      const glow = this.glows.get(COL.grunt);
      if (glow) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glow, r.x - r.w * 1.2, r.y - r.w * 1.2, r.w * 2.4, r.w * 2.4);
      }
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.a);
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = "#132019";
      this.rr(ctx, -r.w * 0.78, -r.w / 2, r.w * 1.56, r.w, 14);
      ctx.fill();
      ctx.fillStyle = COL.grunt;
      this.rr(ctx, -r.w * 0.72, -r.w / 2 + 7, r.w * 1.44, r.w - 14, 11);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      this.rr(ctx, -r.w * 0.62, -r.w / 2 + 12, r.w * 1.24, 9, 5);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) {
        if (q.kind === 0 && q.paint) this.splat(q.x, q.y, q.color, q.size * 3.4, 0.7);
        this.parts.splice(i, 1);
        continue;
      }
      if (q.kind === 0 || q.kind === 1) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        const drag = q.kind === 0 ? 3.4 : 5.2;
        q.vx *= 1 - drag * dt;
        q.vy *= 1 - drag * dt;
      } else if (q.kind === 2) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 1 - 2 * dt;
        q.vy *= 1 - 2 * dt;
        q.size += dt * 60;
      } else if (q.kind === 4) {
        q.y += q.vy * dt;
        q.vy *= 1 - 2.2 * dt;
      }
      q.rot += q.vr * dt;
    }
  }

  /* ---------------- draw ---------------- */

  private draw() {
    const ctx = this.ctx;
    const { W, H, s } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#05100d";
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    const zoom = 1 + this.trauma * 0.014;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    ctx.translate(this.cssW / 2, this.cssH / 2);
    ctx.rotate(this.trauma * this.trauma * 0.022 * Math.sin(this.time * 30));
    ctx.scale(zoom, zoom);
    ctx.translate(-this.cssW / 2, -this.cssH / 2);
    ctx.scale(s, s);
    ctx.lineJoin = "round";

    ctx.drawImage(this.floor, -PAD, -PAD);
    ctx.drawImage(this.paint, 0, 0, W, H);

    // pickups
    for (const q of this.pickups) this.drawPickup(ctx, q);

    // telegraph markers
    for (const t of this.telegraphs) this.drawTelegraph(ctx, t);

    // shadows
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    for (const e of this.enemies) {
      ctx.beginPath();
      ctx.ellipse(e.x + 4, e.y + 7, e.r * 1.05, e.r * 0.62, 0, 0, TAU);
      ctx.fill();
    }
    if (this.status !== "menu") {
      for (const pl of this.pilots()) {
        if (pl.dead) continue;
        ctx.beginPath();
        ctx.ellipse(pl.x + 4, pl.y + 8, pl.r * 1.05, pl.r * 0.6, 0, 0, TAU);
        ctx.fill();
      }
    }

    this.drawParticles(ctx, 0);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    if (this.status !== "menu") for (const pl of this.pilots()) this.drawPlayer(ctx, pl);
    this.drawBullets(ctx);
    this.drawRollers(ctx);
    this.drawParticles(ctx, 1);
    this.drawReticle(ctx);

    ctx.restore();
    this.drawScreenFx(ctx);
  }

  /** mouse reticle + aim tracer (desktop feel) */
  private drawReticle(ctx: CanvasRenderingContext2D) {
    if (this.status !== "playing" || this.dying > 0) return;
    if (this.isTouch || !this.mouse.used) return;
    const mx = clamp(this.mouse.x, 0, this.W);
    const my = clamp(this.mouse.y, 0, this.H);
    let over = false;
    for (const e of this.enemies) {
      if (Math.hypot(e.x - mx, e.y - my) < e.r + 18) {
        over = true;
        break;
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = COL.player;
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 13]);
    ctx.beginPath();
    ctx.moveTo(this.p.x, this.p.y);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 1 + clamp(this.p.fireT * 3.4, 0, 0.55);
    const R = (over ? 18 : 13) * pulse;
    const col = this.p.ammo === 0 ? COL.rusher : over ? COL.grunt : COL.player;
    ctx.translate(mx, my);
    ctx.rotate(this.time * 1.1);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0.18, 1.39);
      ctx.stroke();
      ctx.restore();
    }
    ctx.rotate(-this.time * 1.1);
    ctx.fillStyle = col;
    ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
    if (this.p.ammo === 0) {
      ctx.font = `700 11px "Barlow Semi Condensed", Barlow, sans-serif`;
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.85;
      ctx.fillText("RELOAD", 0, R + 15);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      const glow = this.glows.get(b.color);
      if (glow) {
        ctx.globalAlpha = 0.75;
        ctx.drawImage(glow, b.x - 15, b.y - 15, 30, 30);
        ctx.globalAlpha = 1;
      }
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(2, 0, 2.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, layer: number) {
    for (const q of this.parts) {
      const t = clamp(q.life / q.max, 0, 1);
      if (q.kind === 0 && layer === 0) {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.6, q.size * t), 0, TAU);
        ctx.fill();
      } else if (q.kind === 1 && layer === 1) {
        ctx.globalAlpha = t;
        ctx.fillStyle = q.color;
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      } else if (q.kind === 2 && layer === 0) {
        ctx.globalAlpha = t * 0.4;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * (1 - t * 0.4), 0, TAU);
        ctx.fill();
      } else if (q.kind === 3 && layer === 1) {
        const k = 1 - t;
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 3 + 6 * t;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * (0.25 + k * 1.1), 0, TAU);
        ctx.stroke();
      } else if (q.kind === 4 && layer === 1) {
        ctx.globalAlpha = Math.min(1, t * 1.8);
        ctx.font = `800 ${q.size}px Barlow, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(5,16,13,0.85)";
        ctx.strokeText(q.text, q.x, q.y);
        ctx.fillStyle = q.color;
        ctx.fillText(q.text, q.x, q.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, q: Pickup) {
    const def = PICKUPS[q.kind] ?? PICKUPS[0];
    const col = def.color;
    const bob = Math.sin(this.time * 5 + q.x) * 3;
    const glow = this.glows.get(col);
    ctx.save();
    ctx.translate(q.x, q.y + bob);
    if (glow && q.t > 2.5) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glow, -34, -34, 68, 68);
      ctx.globalAlpha = 1;
    }
    if (q.t < 3) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(q.t * 9));
    ctx.rotate(Math.sin(this.time * 3 + q.y) * 0.12);
    ctx.fillStyle = "#0b1210";
    this.rr(ctx, -13, -11, 26, 22, 5);
    ctx.fill();
    ctx.fillStyle = col;
    this.rr(ctx, -11, -9, 22, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#0b1210";
    ctx.font = "700 14px Barlow, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.label, 0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawTelegraph(ctx: CanvasRenderingContext2D, t: Telegraph) {
    const k = 1 - clamp(t.t / t.dur, 0, 1);
    const col = ENEMY_DEF[t.type].color;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(k * 5);
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(k * 14));
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    const r = lerp(120, 26, k);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(r, -8);
      ctx.lineTo(r, 8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, pl: Pilot) {
    const p = pl;
    const col = p.i === 0 ? COL.player : COL.lime;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    const spd = Math.hypot(p.vx, p.vy);
    const bob = Math.sin(p.step * TAU) * clamp(spd / 260, 0, 1) * 1.8;
    ctx.scale(1, 1 + bob * 0.01);
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.35;
      ctx.save();
      ctx.rotate(p.angle);
      ctx.fillStyle = col;
      this.rr(ctx, -34, -12, 30, 24, 10);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = blink ? 0.45 : 1;
    // glow
    const gl = this.glows.get(col);
    if (gl) {
      ctx.globalAlpha = (blink ? 0.3 : 0.55) * (p.tripleT > 0 || p.rapidT > 0 ? 1.5 : 1);
      ctx.drawImage(gl, -40, -40, 80, 80);
      ctx.globalAlpha = blink ? 0.45 : 1;
    }
    ctx.rotate(p.angle);
    // marker barrel
    ctx.fillStyle = "#132019";
    this.rr(ctx, 6, -5, 26, 10, 4);
    ctx.fill();
    ctx.fillStyle = p.reload > 0 ? "#6f8b7f" : col;
    this.rr(ctx, 24, -4, 8, 8, 3);
    ctx.fill();
    // body
    ctx.fillStyle = "#0b1210";
    this.rr(ctx, -15, -14, 30, 28, 11);
    ctx.fill();
    ctx.fillStyle = p.hitFlash > 0.05 ? "#ffffff" : "#eaf5ee";
    this.rr(ctx, -13, -12, 26, 24, 9);
    ctx.fill();
    ctx.fillStyle = col;
    this.rr(ctx, -13, -12, 9, 24, 6);
    ctx.fill();
    ctx.fillStyle = p.i === 0 ? COL.grunt : COL.boss;
    this.rr(ctx, 4, -12, 9, 24, 6);
    ctx.fill();
    // mask
    ctx.fillStyle = "#0f1c18";
    ctx.beginPath();
    ctx.arc(2, 0, 8.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.hitFlash > 0.05 ? "#ffffff" : "#7ef4ff";
    ctx.beginPath();
    ctx.ellipse(4.5, 0, 4.6, 6.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(5.5, -2, 1.5, 2.2, 0, 0, TAU);
    ctx.fill();
    // hopper tank
    ctx.fillStyle = "#0f1c18";
    ctx.beginPath();
    ctx.arc(-11, -7, 5.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (this.status === "playing" && this.dying <= 0 && !p.dead) {
      // world-space ammo + reload ring
      ctx.save();
      ctx.translate(p.x, p.y - (this.duo ? 42 : 34));
      const n = p.mag;
      for (let i = 0; i < n; i++) {
        const on = i < p.ammo;
        ctx.fillStyle = on ? (p.ammo <= 3 ? COL.rusher : col) : "rgba(233,245,238,0.16)";
        this.rr(ctx, -n * 2.6 + i * 5.2, 0, 3.6, on ? 8 : 6, 1.4);
        ctx.fill();
      }
      if (p.reload > 0) {
        const k = 1 - clamp(p.reload / 0.95, 0, 1);
        ctx.strokeStyle = "rgba(233,245,238,0.25)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 4, 20, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = COL.player;
        ctx.beginPath();
        ctx.arc(0, 4, 20, -Math.PI / 2, -Math.PI / 2 + k * TAU);
        ctx.stroke();
      }
      if (p.dashCd > 0) {
        ctx.strokeStyle = "rgba(255,216,77,0.85)";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 4, 26, -Math.PI / 2, -Math.PI / 2 + (1 - p.dashCd / 1.05) * TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    const def = ENEMY_DEF[e.type];
    const col = def.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.born > 0) {
      const k = 1 - clamp(e.born / 0.3, 0, 1);
      ctx.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k);
      ctx.globalAlpha = 0.4 + 0.6 * k;
    }
    const walk = Math.sin(e.wobble) * 1.6;
    ctx.rotate(e.angle);
    const hit = e.flash > 0.05;
    const body = hit ? "#ffffff" : col;
    if (e.type === "rusher") {
      ctx.fillStyle = "#0b1210";
      ctx.beginPath();
      ctx.moveTo(e.r + 8, 0);
      ctx.lineTo(-e.r, -e.r - 2 + walk);
      ctx.lineTo(-e.r, e.r + 2 - walk);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.r + 3, 0);
      ctx.lineTo(-e.r + 4, -e.r + 2 + walk);
      ctx.lineTo(-e.r + 4, e.r - 2 - walk);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0b1210";
      ctx.beginPath();
      ctx.arc(3, 0, 5.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(5, 0, 2.4, 0, TAU);
      ctx.fill();
    } else if (e.type === "boss") {
      ctx.fillStyle = "#132019";
      this.rr(ctx, 4, -13, 40, 12, 5);
      ctx.fill();
      this.rr(ctx, 4, 3, 40, 12, 5);
      ctx.fill();
      ctx.fillStyle = "#0b1210";
      this.rr(ctx, -e.r - 2, -e.r, (e.r + 2) * 2, e.r * 2, 12);
      ctx.fill();
      ctx.fillStyle = body;
      this.rr(ctx, -e.r + 2, -e.r + 3, (e.r - 2) * 2, (e.r - 3) * 2, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(11,18,16,0.55)";
      this.rr(ctx, -e.r + 6, -5, e.r * 2 - 12, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(e.r - 8, 0, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#0b1210";
      ctx.beginPath();
      ctx.arc(e.r - 6, 0, 4.6, 0, TAU);
      ctx.fill();
    } else {
      const long = e.type === "sniper";
      ctx.fillStyle = "#132019";
      this.rr(ctx, 5, -4, long ? 32 : 22, 8, 3);
      ctx.fill();
      if (long) {
        ctx.fillStyle = e.charge > 0 ? "#ffffff" : col;
        this.rr(ctx, 30, -3.4, 7, 7, 2);
        ctx.fill();
      }
      ctx.fillStyle = "#0b1210";
      this.rr(ctx, -e.r - 1, -e.r - 1, (e.r + 1) * 2, (e.r + 1) * 2, 9);
      ctx.fill();
      ctx.fillStyle = body;
      this.rr(ctx, -e.r + 2, -e.r + 2, (e.r - 2) * 2, (e.r - 2) * 2, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(11,18,16,0.4)";
      this.rr(ctx, -e.r + 4, -e.r + 4, (e.r - 4) * 2, 5, 2);
      ctx.fill();
      ctx.fillStyle = "#0f1c18";
      ctx.beginPath();
      ctx.arc(3, 0, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(5, 0, 3.6, 5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // charge beam telegraph
    if (e.type === "sniper" && e.charge > 0) {
      const k = 1 - e.charge / 0.62;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1 + 2.4 * k;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 900, e.y + Math.sin(e.angle) * 900);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // hp pip bar
    if (e.hp < e.maxHp) {
      const w = e.r * 2.2;
      const f = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(5,16,13,0.75)";
      ctx.fillRect(e.x - w / 2 - 1, e.y - e.r - 13, w + 2, 5);
      ctx.fillStyle = e.type === "boss" ? COL.boss : "#e9f5ee";
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * f, 3);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- screen space ---------------- */

  private drawScreenFx(ctx: CanvasRenderingContext2D) {
    const { cssW: w, cssH: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // low-hp pulse
    if (this.status === "playing" && this.p.hp <= 2 && this.dying <= 0) {
      const a = 0.1 + 0.14 * Math.abs(Math.sin(this.time * 6));
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.62);
      rg.addColorStop(0, "rgba(255,47,135,0)");
      rg.addColorStop(1, `rgba(255,47,135,${a})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.flashAmt > 0.01) {
      ctx.globalAlpha = clamp(this.flashAmt, 0, 1) * 0.5;
      ctx.fillStyle = this.flashCol;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if (this.isTouch && this.status === "playing") this.drawTouch(ctx);

    // banners
    let by = h * 0.3;
    for (const b of this.banners) {
      const k = b.t / b.dur;
      const inK = clamp(b.t / 0.16, 0, 1);
      const sc = 0.7 + 0.3 * inK + Math.sin(b.t * 26) * 0.02 * (1 - inK);
      ctx.save();
      ctx.globalAlpha = clamp((1 - k) / 0.25, 0, 1);
      ctx.translate(w / 2, by);
      ctx.rotate(-0.02);
      ctx.scale(sc, sc);
      const size = clamp(w / 12, 26, 62);
      ctx.font = `${size}px Bungee, Barlow, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = "#05100d";
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = `800 ${size * 0.3}px "Barlow Semi Condensed", Barlow, sans-serif`;
        ctx.lineWidth = size * 0.1;
        ctx.strokeText(b.sub, 0, size * 0.62);
        ctx.fillStyle = "#e9f5ee";
        ctx.fillText(b.sub, 0, size * 0.62);
      }
      ctx.restore();
      by += 78;
      ctx.globalAlpha = 1;
    }
  }

  /** couche tactile : sticks flottants, cluster de boutons, gestuelle du premier lancement */
  private drawTouch(ctx: CanvasRenderingContext2D) {
    const R = this.stickR;
    const showSticks = this.status === "playing";
    const b = this.btn;

    const stick = (
      st: { active: boolean; ox: number; oy: number; dx: number; dy: number },
      hx: number,
      hy: number,
      col: string,
      label: string
    ) => {
      const bx = st.active ? st.ox : hx;
      const by = st.active ? st.oy : hy;
      const a = st.active ? 1 : 0.42;
      ctx.save();
      ctx.globalAlpha = 0.26 * a;
      ctx.fillStyle = "#050f0c";
      ctx.beginPath();
      ctx.arc(bx, by, R, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = (st.active ? 0.8 : 0.34) * a;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(st.active ? [] : [7, 8]);
      ctx.beginPath();
      ctx.arc(bx, by, R, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // crans cardinaux
      ctx.globalAlpha = 0.3 * a;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(R - 9, 0);
        ctx.lineTo(R - 2, 0);
        ctx.stroke();
        ctx.restore();
      }
      const kx = bx + st.dx * R;
      const ky = by + st.dy * R;
      ctx.globalAlpha = st.active ? 0.95 : 0.4;
      const glow = this.glows.get(col);
      if (glow && st.active) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glow, kx - R * 0.9, ky - R * 0.9, R * 1.8, R * 1.8);
        ctx.globalAlpha = 0.95;
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(kx, ky, R * (st.active ? 0.4 : 0.3), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#050f0c";
      ctx.beginPath();
      ctx.arc(kx, ky, R * 0.19, 0, TAU);
      ctx.fill();
      if (!st.active && label) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = col;
        ctx.font = `700 ${Math.round(R * 0.26)}px "Barlow Semi Condensed", Barlow, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bx, by + R + 12);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    if (showSticks) {
      stick(this.stickMove, this.home.mx, this.home.my, COL.player, "BOUGE");
      stick(this.stickAim, this.home.ax, this.home.ay, COL.grunt, "VISE");
    }

    // --- cluster pouce droit ---------------------------------------------
    const round = (
      bb: { x: number; y: number; r: number; press: number },
      col: string,
      fill: string,
      label: string,
      prog: number,
      held: boolean,
      icon: (g: CanvasRenderingContext2D, r: number) => void
    ) => {
      const rr = bb.r * (1 + bb.press * 0.5);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#050f0c";
      ctx.beginPath();
      ctx.arc(bb.x, bb.y + 3, rr + 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = held ? 0.95 : 0.62;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(bb.x, bb.y, rr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(bb.x, bb.y, rr, 0, TAU);
      ctx.stroke();
      if (prog > 0.001) {
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bb.x, bb.y, rr + 5, -Math.PI / 2, -Math.PI / 2 + clamp(prog, 0, 1) * TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = held ? 1 : 0.8;
      ctx.save();
      ctx.translate(bb.x, bb.y - (label ? 4 : 0));
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      icon(ctx, rr);
      ctx.restore();
      if (label) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = col;
        ctx.font = `700 ${Math.round(rr * 0.36)}px "Barlow Semi Condensed", Barlow, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bb.x, bb.y + rr * 0.5);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    if (showSticks) {
      const dashReady = this.p.dashCd <= 0;
      // FEU : balle restante dans le chargeur au centre
      round(
        b.fire,
        this.p.ammo === 0 ? COL.rusher : COL.chalk,
        this.btn.fire.id !== -1 ? "rgba(62,232,255,0.34)" : "rgba(11,18,16,0.62)",
        "",
        this.p.reload > 0 ? 1 - this.p.reload / 0.95 : this.p.ammo / this.p.mag,
        this.btn.fire.id !== -1,
        (g, r) => {
          g.beginPath();
          g.arc(0, 0, r * 0.42, 0, TAU);
          g.stroke();
          g.beginPath();
          g.arc(0, 0, r * 0.14, 0, TAU);
          g.fill();
          g.font = `800 ${Math.round(r * 0.42)}px "Barlow Semi Condensed", Barlow, sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "alphabetic";
          g.globalAlpha = 0.9;
          g.fillText(String(this.p.ammo), 0, r * 0.78);
        }
      );
      round(b.dash, dashReady ? COL.boss : "rgba(233,245,238,0.45)", "rgba(11,18,16,0.6)", "", 1 - clamp(this.p.dashCd / 1.05, 0, 1), this.btn.dash.id !== -1, (g, r) => {
        g.beginPath();
        g.moveTo(-r * 0.2, -r * 0.42);
        g.lineTo(r * 0.16, -r * 0.06);
        g.lineTo(-r * 0.1, -r * 0.06);
        g.lineTo(r * 0.12, r * 0.34);
        g.stroke();
        g.font = `700 ${Math.round(r * 0.4)}px "Barlow Semi Condensed", Barlow, sans-serif`;
        g.textAlign = "center";
        g.globalAlpha = 0.8;
        g.fillText("DASH", 0, r * 0.78);
      });
      round(b.reload, this.p.ammo < this.p.mag ? COL.lime : "rgba(233,245,238,0.4)", "rgba(11,18,16,0.6)", "", this.p.reload > 0 ? 1 - this.p.reload / 0.95 : 0, this.btn.reload.id !== -1, (g, r) => {
        g.beginPath();
        g.arc(0, 0, r * 0.4, 0.5, TAU - 0.9);
        g.stroke();
        g.beginPath();
        g.moveTo(r * 0.1, -r * 0.52);
        g.lineTo(r * 0.46, -r * 0.28);
        g.lineTo(r * 0.06, -r * 0.1);
        g.closePath();
        g.fill();
      });
    }

    // --- gestuelle du premier lancement ----------------------------------
    if (this.tutorialT > 0 && showSticks) {
      const a = clamp(this.tutorialT / 1.2, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      const hint = (x: number, y: number, text: string, col: string, dir: number) => {
        ctx.save();
        ctx.globalAlpha = 0.85 * a;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + dir * 26 * pulse, y, 15 + 6 * pulse, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.5 * a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x + dir * 26 * pulse, y, 7, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.9 * a;
        ctx.font = `800 13px "Barlow Semi Condensed", Barlow, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = col;
        ctx.strokeStyle = "rgba(5,16,13,0.9)";
        ctx.lineWidth = 4;
        ctx.strokeText(text, x, y - 34);
        ctx.fillText(text, x, y - 34);
        ctx.restore();
        ctx.globalAlpha = 1;
      };
      hint(this.home.mx, this.home.my, "GLISSE POUR BOUGER", COL.player, 1);
      hint(this.home.ax, this.home.ay, "GLISSE POUR VISER", COL.grunt, -1);
      hint(b.fire.x, b.fire.y - b.fire.r - 8, "MAINTIENS POUR TIRER", COL.chalk, -1);
    }
  }

  /* ---------------- réseau : pilote distant + snapshots ---------------- */

  /** L'index pilote est piloté par le réseau ; l'index local passe en commandes primaires. */
  setNetPilot(idx: number | null) {
    this.netPilot = idx === null ? null : { idx, input: null };
  }
  setLocalIndex(i: number) {
    this.localIdx = i;
    this.queued = { dash: false, reload: false };
  }
  localPilot(): Pilot {
    return this.localIdx === 1 && this.p2 ? this.p2 : this.p;
  }
  setRemoteInput(input: RemoteInput | null) {
    if (this.netPilot) this.netPilot.input = input;
  }
  /** Entrées du joueur local, prêtes à partir sur le réseau (one-shots consommés). */
  getLocalInput(): RemoteInput {
    const p = this.localPilot();
    const out: RemoteInput = {
      mx: this.axisX(0),
      my: this.axisY(0),
      aim: p.angle,
      fire: this.firing(0),
      dash: this.queued.dash,
      reload: this.queued.reload,
    };
    this.queued = { dash: false, reload: false };
    return out;
  }
  getSnapshot(): Snapshot {
    return {
      t: this.time,
      wave: this.wave,
      score: Math.floor(this.score),
      kills: this.kills,
      pilots: this.pilots().map((pl) => ({
        x: pl.x, y: pl.y, a: pl.angle, hp: pl.hp, ammo: pl.ammo, dead: pl.dead,
      })),
      enemies: this.enemies.slice(0, 24).map((e) => ({
        x: e.x,
        y: e.y,
        a: e.angle,
        hp: e.hp,
        kind: e.type === "grunt" ? 0 : e.type === "rusher" ? 1 : e.type === "sniper" ? 2 : 3,
      })),
    };
  }
  /** Côté client : on aligne la réplique locale sur l'état de l'hôte. */
  applySnapshot(s: Snapshot) {
    if (!this.p2) return;
    const mine = this.netPilot ? this.netPilot.idx : 0;
    const remote = mine === 0 ? this.p : this.p2;
    const self = mine === 0 ? this.p2 : this.p;
    const r = s.pilots[mine];
    const l = s.pilots[mine === 0 ? 1 : 0];
    if (r) {
      remote.x = r.x;
      remote.y = r.y;
      remote.angle = r.a;
      remote.hp = r.hp;
      remote.ammo = r.ammo;
      remote.dead = r.dead;
    }
    if (l) {
      self.hp = l.hp;
      self.ammo = l.ammo;
      self.dead = l.dead;
    }
    const used = new Set<number>();
    for (const n of s.enemies) {
      let best = -1;
      let bd = 1e9;
      for (let i = 0; i < this.enemies.length; i++) {
        if (used.has(i)) continue;
        const d = Math.hypot(this.enemies[i].x - n.x, this.enemies[i].y - n.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) continue;
      used.add(best);
      const e = this.enemies[best];
      e.x = n.x;
      e.y = n.y;
      e.angle = n.a;
      e.hp = n.hp;
    }
    this.score = Math.max(this.score, s.score);
    this.wave = Math.max(this.wave, s.wave);
    this.kills = Math.max(this.kills, s.kills);
  }

  /* ---------------- sauvegarde de partie (reprendre plus tard) ---------------- */

  /** État complet de la partie en cours, prêt à être stocké (local ou base). */
  exportSave(): SaveState | null {
    if (this.status !== "playing" && this.status !== "paused") return null;
    if (this.dying > 0 || this.allDown()) return null;
    let paint: string | undefined;
    try {
      const w = 460;
      const h = Math.max(1, Math.round((this.paint.height / Math.max(1, this.paint.width)) * w));
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tg = tmp.getContext("2d");
      if (tg) {
        tg.drawImage(this.paint, 0, 0, w, h);
        const data = tmp.toDataURL("image/jpeg", 0.55);
        if (data.length < 320_000) paint = data;
      }
    } catch {
      paint = undefined;
    }
    return {
      v: 1,
      at: Date.now(),
      label: `VAGUE ${this.wave} · ${Math.floor(this.score).toLocaleString()} PTS`,
      duo: this.duo,
      gw: this.gw,
      gh: this.gh,
      score: Math.floor(this.score),
      wave: this.wave,
      kills: this.kills,
      shots: this.shots,
      hits: this.hits,
      streak: this.streak,
      maxCombo: this.maxCombo,
      time: this.time,
      between: this.between,
      spawnT: this.spawnT,
      maxAlive: this.maxAlive,
      pending: this.pending.slice(),
      pilots: this.pilots().map((pl) => ({ ...pl })),
      enemies: this.enemies.map((e) => ({ ...e })),
      covered: gridToB64(this.covered),
      paint,
    };
  }

  /** Reprend une partie sauvegardée, exactement là où elle s'était arrêtée. */
  importSave(s: SaveState) {
    this.sfx.unlock();
    this.duo = !!s.duo;
    this.resetRun();
    this.score = s.score;
    this.wave = s.wave;
    this.kills = s.kills;
    this.shots = s.shots;
    this.hits = s.hits;
    this.streak = s.streak;
    this.maxCombo = s.maxCombo;
    this.time = s.time;
    this.between = s.between || 0;
    this.spawnT = s.spawnT || 0;
    this.maxAlive = s.maxAlive || 8;
    this.pending = (s.pending ?? []).slice() as EType[];
    this.p = { ...s.pilots[0], i: 0, dead: !!s.pilots[0]?.dead };
    this.p2 = s.duo && s.pilots[1] ? { ...s.pilots[1], i: 1 } : null;
    this.enemies = (s.enemies ?? []).map((e) => ({ ...e }));
    this.pilots().forEach((pl) => {
      pl.invuln = Math.max(pl.invuln, 1.2);
    });

    const grid = b64ToGrid(s.covered ?? "");
    this.covered.fill(0);
    this.coveredCount = 0;
    if (s.gw && s.gh && (s.gw !== this.gw || s.gh !== this.gh)) {
      for (let y = 0; y < this.gh; y++) {
        for (let x = 0; x < this.gw; x++) {
          const sx = Math.min(s.gw - 1, Math.floor((x / this.gw) * s.gw));
          const sy = Math.min(s.gh - 1, Math.floor((y / this.gh) * s.gh));
          if (grid[sy * s.gw + sx]) {
            const i = y * this.gw + x;
            this.covered[i] = 1;
            this.coveredCount++;
          }
        }
      }
    } else if (grid.length === this.covered.length) {
      this.covered.set(grid);
      for (let i = 0; i < grid.length; i++) if (grid[i]) this.coveredCount++;
    }

    this.clearPaint();
    if (s.paint) {
      const img = new Image();
      img.onload = () => {
        try {
          this.paintCtx.drawImage(img, 0, 0, this.W, this.H);
        } catch {
          /* terrain propre : la partie reste jouable */
        }
      };
      img.src = s.paint;
    }

    this.trauma = 0;
    this.flashAmt = 0;
    this.dying = 0;
    this.tutorialT = 0;
    this.banners.length = 0;
    this.telegraphs.length = 0;
    this.parts.length = 0;
    this.bullets.length = 0;
    this.setStatus("playing");
    this.loopStart();
    this.banner("REPRISE", "VAGUE " + this.wave, COL.lime, 1.8);
    this.sfx.wave();
  }

  /* ---------------- game over ---------------- */

  private gameOver() {
    this.setStatus("gameover");
    const res: RunResult = {
      duo: this.duo,
      score: Math.floor(this.score),
      kills2: this.killsBy[1],
      hits2: this.hitsBy[1],
      wave: this.wave,
      kills: this.kills,
      shots: this.shots,
      hits: this.hits,
      maxCombo: this.maxCombo,
      coverage: this.coverage,
      time: this.time,
    };
    this.cb.onGameOver(res);
  }

  toggleMute() {
    const m = !this.sfx.muted;
    this.sfx.setMuted(m);
    localStorage.setItem("pb.muted", m ? "1" : "0");
    return m;
  }
}
