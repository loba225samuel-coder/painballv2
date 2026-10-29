/* Simulation multijoueur pure : aucune dépendance DOM.
 * Utilisée telle quelle par le duo local ET par le serveur autoritaire. */

import {
  BONUS,
  COL,
  DROP_TABLE,
  ENEMY_DEF,
  GRAPPE_DMG,
  GRAPPE_LIFE,
  GRAPPE_SHOTS,
  GRAPPE_SPREAD,
  INK_DURATION,
  INK_SLOW_DURATION,
  INK_SLOW_FACTOR,
  MAGNET_DURATION,
  MAGNET_SPEED,
  MAGNET_RADIUS,
  PLAYER,
  TAU,
  TURBO_DURATION,
  TURBO_SPEED,
  WORLD,
  clamp,
  comboMult,
  makeBunkers,
  sanitizeName,
} from "./rules";
import type { BonusKind } from "./rules";
import type { Bunker, EType } from "./rules";

export type MpMode = "coop" | "versus";
export type MpPhase = "lobby" | "countdown" | "playing" | "ended";

export interface MpInput {
  seq: number;
  mx: number;
  my: number;
  aim: number;
  fire: boolean;
  dash: boolean;
  reload: boolean;
}

export interface MpPlayer {
  id: string;
  token?: string;
  name: string;
  slot: 0 | 1;
  color: string;
  ready: boolean;
  connected: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  r: number;
  hp: number;
  maxHp: number;
  ammo: number;
  mag: number;
  reload: number;
  reloadFrom: number;
  fireT: number;
  dashT: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  invuln: number;
  tripleT: number;
  rapidT: number;
  shield: number;
  shieldT: number;
  ricochetT: number;
  explosive: number;
  rollerT: number;
  rollerTick: number;
  turboT: number;
  magnetT: number;
  cluster: number;
  inkT: number;
  slowT: number;
  down: boolean;
  downT: number;
  revive: number;
  score: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  lastSeq: number;
}

export interface MpEnemy {
  id: number;
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
  volley: number;
  stormT: number;
  born: number;
  slowT: number;
}

export interface MpBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  color: string;
  foe: boolean;
  owner: string | null;
  bounces?: number;
  explosive?: boolean;
}

export interface MpPickup {
  id: number;
  x: number;
  y: number;
  kind: BonusKind;
  t: number;
}

export type MpEvent =
  | { id: number; t: "shot"; x: number; y: number; angle: number; color: string; owner: string | null }
  | { id: number; t: "paint"; x: number; y: number; color: string; size: number; owner: string | null }
  | { id: number; t: "hit"; x: number; y: number; color: string }
  | { id: number; t: "kill"; x: number; y: number; color: string; amount: number; text: string }
  | { id: number; t: "hurt"; x: number; y: number; color: string; owner: string }
  | { id: number; t: "down"; x: number; y: number; color: string; owner: string }
  | { id: number; t: "revive"; x: number; y: number; color: string; owner: string }
  | { id: number; t: "dash"; x: number; y: number; color: string }
  | { id: number; t: "pickup"; x: number; y: number; color: string; text: string }
  | { id: number; t: "shield"; x: number; y: number; color: string; owner: string }
  | { id: number; t: "explode"; x: number; y: number; color: string }
  | { id: number; t: "wave"; text: string; sub: string; color: string }
  | { id: number; t: "end"; text: string; sub: string; color: string };

export interface SimState {
  tick: number;
  time: number;
  mode: MpMode;
  phase: MpPhase;
  countdown: number;
  hostId: string | null;
  wave: number;
  teamScore: number;
  teamStreak: number;
  comboT: number;
  timeLeft: number;
  winner: string | null;
  players: MpPlayer[];
  enemies: MpEnemy[];
  bullets: MpBullet[];
  pickups: MpPickup[];
  events: MpEvent[];
  bunkers: Bunker[];
  cell: number;
  gw: number;
  gh: number;
  owner: number[];
  painted: number;
  ownerCells: [number, number];
  pending: EType[];
  spawnT: number;
  between: number;
  maxAlive: number;
  inputs: Record<string, MpInput>;
  nextId: number;
  rng: number;
}

export const defaultInput = (): MpInput => ({ seq: 0, mx: 0, my: 0, aim: 0, fire: false, dash: false, reload: false });

export function createSim(mode: MpMode, seed = Date.now() >>> 0): SimState {
  const cell = 48;
  const gw = Math.ceil(WORLD.w / cell);
  const gh = Math.ceil(WORLD.h / cell);
  return {
    tick: 0,
    time: 0,
    mode,
    phase: "lobby",
    countdown: 0,
    hostId: null,
    wave: 0,
    teamScore: 0,
    teamStreak: 0,
    comboT: 0,
    timeLeft: mode === "versus" ? 90 : 0,
    winner: null,
    players: [],
    enemies: [],
    bullets: [],
    pickups: [],
    events: [],
    bunkers: makeBunkers(),
    cell,
    gw,
    gh,
    owner: new Array(gw * gh).fill(0),
    painted: 0,
    ownerCells: [0, 0],
    pending: [],
    spawnT: 0,
    between: 0,
    maxAlive: 8,
    inputs: {},
    nextId: 1,
    rng: seed || 1,
  };
}

function rand(s: SimState) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (s: SimState, a: number, b: number) => a + rand(s) * (b - a);

type NewEvent = { [K in MpEvent as K["t"]]: Omit<K, "id"> }[MpEvent["t"]];

function ev(s: SimState, e: NewEvent) {
  s.events.push({ ...e, id: s.nextId++ } as MpEvent);
  if (s.events.length > 240) s.events.splice(0, s.events.length - 240);
}

export function drainEvents(s: SimState) {
  const e = s.events;
  s.events = [];
  return e;
}

export function addPlayer(s: SimState, id: string, name: string, token?: string): MpPlayer | null {
  if (s.players.length >= 2) return null;
  const slot = (s.players.length === 0 ? 0 : 1) as 0 | 1;
  const p: MpPlayer = {
    id,
    token,
    name: sanitizeName(name, slot === 0 ? "JOUEUR 1" : "JOUEUR 2"),
    slot,
    color: slot === 0 ? COL.player : s.mode === "versus" ? COL.grunt : COL.lime,
    ready: false,
    connected: true,
    x: slot === 0 ? WORLD.w * 0.35 : WORLD.w * 0.65,
    y: WORLD.h * 0.72,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    r: PLAYER.r,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    ammo: PLAYER.mag,
    mag: PLAYER.mag,
    reload: 0,
    reloadFrom: 0,
    fireT: 0,
    dashT: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    tripleT: 0,
    rapidT: 0,
    shield: 0,
    shieldT: 0,
    ricochetT: 0,
    explosive: 0,
    rollerT: 0,
    rollerTick: 0,
    turboT: 0,
    magnetT: 0,
    cluster: 0,
    inkT: 0,
    slowT: 0,
    down: false,
    downT: 0,
    revive: 0,
    score: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    lastSeq: 0,
  };
  s.players.push(p);
  s.inputs[id] = defaultInput();
  if (!s.hostId) s.hostId = id;
  return p;
}

export function removePlayer(s: SimState, id: string) {
  s.players = s.players.filter((p) => p.id !== id);
  delete s.inputs[id];
  if (s.hostId === id) s.hostId = s.players[0]?.id ?? null;
}

export function setInput(s: SimState, id: string, input: MpInput) {
  const p = s.players.find((x) => x.id === id);
  if (!p) return;
  if (!Number.isFinite(input.seq) || input.seq < p.lastSeq) return;
  p.lastSeq = input.seq;
  s.inputs[id] = {
    seq: input.seq,
    mx: clamp(Number(input.mx) || 0, -1, 1),
    my: clamp(Number(input.my) || 0, -1, 1),
    aim: Number.isFinite(input.aim) ? input.aim : 0,
    fire: !!input.fire,
    dash: !!input.dash,
    reload: !!input.reload,
  };
}

export function startMatch(s: SimState) {
  if (s.players.length < 2) return false;
  s.phase = "countdown";
  s.countdown = 2.2;
  s.tick = 0;
  s.time = 0;
  s.wave = 0;
  s.teamScore = 0;
  s.teamStreak = 0;
  s.comboT = 0;
  s.timeLeft = s.mode === "versus" ? 90 : 0;
  s.winner = null;
  s.enemies = [];
  s.bullets = [];
  s.pickups = [];
  s.pending = [];
  s.between = 0;
  s.spawnT = 0;
  s.owner.fill(0);
  s.painted = 0;
  s.ownerCells = [0, 0];
  for (const p of s.players) {
    p.x = s.mode === "versus" ? (p.slot === 0 ? WORLD.w * 0.18 : WORLD.w * 0.82) : p.slot === 0 ? WORLD.w * 0.38 : WORLD.w * 0.62;
    p.y = s.mode === "versus" ? WORLD.h / 2 : WORLD.h * 0.72;
    p.vx = p.vy = 0;
    p.angle = p.slot === 0 ? 0 : Math.PI;
    p.hp = p.maxHp;
    p.ammo = p.mag;
    p.reload = p.fireT = p.dashT = p.dashCd = p.invuln = p.tripleT = p.rapidT = 0;
    p.shield = p.shieldT = p.ricochetT = p.explosive = p.rollerT = p.rollerTick = 0;
    p.turboT = p.magnetT = p.cluster = p.inkT = p.slowT = 0;
    p.down = false;
    p.downT = 0;
    p.revive = 0;
    p.score = p.kills = p.deaths = p.shots = p.hits = 0;
    p.lastSeq = 0;
    p.ready = true;
  }
  ev(s, { t: "wave", text: s.mode === "coop" ? "COOP" : "VERSUS", sub: "PRÊTS ?", color: COL.chalk });
  return true;
}

export function coverage(s: SimState) {
  return s.painted / Math.max(1, s.gw * s.gh);
}

export function finalScore(s: SimState, p: MpPlayer) {
  return p.score + (s.mode === "versus" ? s.ownerCells[p.slot] * 25 : 0);
}

function paintAt(s: SimState, x: number, y: number, color: string, size: number, owner: string | null) {
  ev(s, { t: "paint", x, y, color, size, owner });
  if (size < 22 || x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return;
  const p = s.players.find((q) => q.id === owner);
  const val = p ? p.slot + 1 : 1;
  const i = clamp(Math.floor(y / s.cell), 0, s.gh - 1) * s.gw + clamp(Math.floor(x / s.cell), 0, s.gw - 1);
  const old = s.owner[i];
  if (old === val) return;
  if (old === 0) s.painted++;
  else s.ownerCells[old - 1] = Math.max(0, s.ownerCells[old - 1] - 1);
  s.owner[i] = val;
  s.ownerCells[val - 1]++;
}

function inBunker(s: SimState, x: number, y: number, pad = 0) {
  for (const b of s.bunkers) if (Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(y - b.y) <= b.h / 2 + pad) return true;
  return false;
}

function collide(s: SimState, o: { x: number; y: number; vx: number; vy: number }, r: number) {
  for (const b of s.bunkers) {
    const hw = b.w / 2;
    const hh = b.h / 2;
    const cx = clamp(o.x, b.x - hw, b.x + hw);
    const cy = clamp(o.y, b.y - hh, b.y + hh);
    const dx = o.x - cx;
    const dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        o.x = cx + (dx / d) * r;
        o.y = cy + (dy / d) * r;
        const dot = o.vx * (dx / d) + o.vy * (dy / d);
        if (dot < 0) {
          o.vx -= (dx / d) * dot;
          o.vy -= (dy / d) * dot;
        }
      } else {
        o.y = b.y - hh - r;
        o.vy = -Math.abs(o.vy);
      }
    }
  }
  const m = 18;
  if (o.x < m) { o.x = m; o.vx = Math.max(0, o.vx); }
  if (o.x > WORLD.w - m) { o.x = WORLD.w - m; o.vx = Math.min(0, o.vx); }
  if (o.y < m) { o.y = m; o.vy = Math.max(0, o.vy); }
  if (o.y > WORLD.h - m) { o.y = WORLD.h - m; o.vy = Math.min(0, o.vy); }
}

/** Prédiction client : uniquement le mouvement local, réconcilié ensuite. */
export function predictMotion(p: MpPlayer, input: MpInput, dt: number, bunkers: Bunker[]) {
  if (p.down) return;
  p.angle = input.aim;
  if (input.dash && p.dashCd <= 0 && p.dashT <= 0) {
    let dx = input.mx;
    let dy = input.my;
    if (!dx && !dy) { dx = Math.cos(input.aim); dy = Math.sin(input.aim); }
    const l = Math.hypot(dx, dy) || 1;
    p.dashX = dx / l;
    p.dashY = dy / l;
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCd;
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashX * PLAYER.dashSpeed;
    p.vy = p.dashY * PLAYER.dashSpeed;
  } else {
    const speed = PLAYER.speed * (p.turboT > 0 ? TURBO_SPEED : 1) * (p.slowT > 0 ? INK_SLOW_FACTOR : 1);
    const mag = Math.hypot(input.mx, input.my);
    const tx = mag > 0.02 ? (input.mx / Math.max(mag, 1)) * speed : 0;
    const ty = mag > 0.02 ? (input.my / Math.max(mag, 1)) * speed : 0;
    const k = 1 - Math.exp(-(mag > 0.02 ? 16 : 11) * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
  }
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  collide({ bunkers } as SimState, p, p.r);
}

function los(s: SimState, a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.min(28, Math.max(4, Math.floor(d / 28)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (inBunker(s, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

function startReload(p: MpPlayer) {
  if (p.reload > 0 || p.ammo >= p.mag) return;
  p.reload = PLAYER.reload;
  p.reloadFrom = p.ammo;
}

function fire(s: SimState, p: MpPlayer) {
  if (p.reload > 0 || p.fireT > 0 || p.dashT > 0 || p.down) return;
  if (p.ammo <= 0) return startReload(p);
  p.ammo--;
  p.fireT = p.rapidT > 0 ? PLAYER.rapidFire : PLAYER.fire;
  const clusterShot = p.cluster > 0;
  const n = clusterShot ? GRAPPE_SHOTS : p.tripleT > 0 ? 3 : 1;
  const explosiveShot = p.explosive > 0;
  for (let i = 0; i < n; i++) {
    const off = clusterShot ? (i / (n - 1) - 0.5) * GRAPPE_SPREAD : n === 1 ? 0 : (i - 1) * 0.13;
    const a = p.angle + off + rr(s, -0.03, 0.03) * (clusterShot ? 1.6 : 1);
    s.bullets.push({
      id: s.nextId++,
      x: p.x + Math.cos(a) * 20,
      y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * (clusterShot ? 640 : PLAYER.bulletSpeed) + p.vx * 0.22,
      vy: Math.sin(a) * (clusterShot ? 640 : PLAYER.bulletSpeed) + p.vy * 0.22,
      r: explosiveShot && i === 0 ? 7 : 5,
      dmg: s.mode === "versus" ? 1 : clusterShot ? GRAPPE_DMG : PLAYER.bulletDmg,
      life: clusterShot ? GRAPPE_LIFE : 1.25,
      color: explosiveShot && i === 0 ? COL.rusher : clusterShot ? BONUS[8].color : p.color,
      foe: false,
      owner: p.id,
      bounces: p.ricochetT > 0 ? 1 : 0,
      explosive: explosiveShot && i === 0,
    });
  }
  p.shots += n;
  if (clusterShot) p.cluster = Math.max(0, p.cluster - 1);
  if (explosiveShot) p.explosive = Math.max(0, p.explosive - 1);
  p.vx -= Math.cos(p.angle) * 42;
  p.vy -= Math.sin(p.angle) * 42;
  ev(s, { t: "shot", x: p.x, y: p.y, angle: p.angle, color: p.color, owner: p.id });
  if (p.ammo === 0) startReload(p);
}

function hurt(s: SimState, p: MpPlayer, dmg: number, x: number, y: number, color: string, attacker?: MpPlayer) {
  if (p.invuln > 0 || p.down) return;
  if (p.shield > 0) {
    p.shield--;
    p.invuln = 0.55;
    if (p.shield <= 0) p.shieldT = 0;
    ev(s, { t: "shield", x: p.x, y: p.y, color: "#7ef4ff", owner: p.id });
    return;
  }
  p.hp -= dmg;
  p.invuln = 1.15;
  const a = Math.atan2(p.y - y, p.x - x);
  p.vx += Math.cos(a) * 210;
  p.vy += Math.sin(a) * 210;
  paintAt(s, p.x, p.y, color, 74, attacker?.id ?? null);
  ev(s, { t: "hurt", x: p.x, y: p.y, color, owner: p.id });
  if (p.hp > 0) return;
  p.hp = 0;
  p.down = true;
  p.deaths++;
  p.downT = s.mode === "versus" ? 2.5 : 0;
  ev(s, { t: "down", x: p.x, y: p.y, color, owner: p.id });
  paintAt(s, p.x, p.y, color, 150, attacker?.id ?? null);
  if (s.mode === "versus" && attacker && attacker.id !== p.id) {
    attacker.score += 250;
    attacker.kills++;
    ev(s, { t: "kill", x: p.x, y: p.y, color, amount: 250, text: "+250" });
  }
}

function updatePlayers(s: SimState, dt: number) {
  for (const p of s.players) {
    const input = p.connected ? s.inputs[p.id] ?? defaultInput() : defaultInput();
    p.invuln = Math.max(0, p.invuln - dt);
    p.tripleT = Math.max(0, p.tripleT - dt);
    p.rapidT = Math.max(0, p.rapidT - dt);
    p.ricochetT = Math.max(0, p.ricochetT - dt);
    p.rollerT = Math.max(0, p.rollerT - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.turboT = Math.max(0, p.turboT - dt);
    p.inkT = Math.max(0, p.inkT - dt);
    p.magnetT = Math.max(0, p.magnetT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    if (p.shieldT <= 0) p.shield = 0;

    if (p.down) {
      if (s.mode === "versus") {
        p.downT -= dt;
        if (p.downT <= 0) {
          p.down = false;
          p.hp = p.maxHp;
          p.ammo = p.mag;
          p.reload = 0;
          p.invuln = 1.6;
          p.x = p.slot === 0 ? WORLD.w * 0.18 : WORLD.w * 0.82;
          p.y = WORLD.h / 2;
          p.vx = p.vy = 0;
          ev(s, { t: "revive", x: p.x, y: p.y, color: p.color, owner: p.id });
        }
      } else {
        const ally = s.players.find((q) => q.id !== p.id && !q.down && q.connected);
        if (ally && Math.hypot(ally.x - p.x, ally.y - p.y) < 62) {
          p.revive += dt;
          if (p.revive >= 1.5) {
            p.down = false;
            p.hp = 3;
            p.revive = 0;
            p.invuln = 1.6;
            ev(s, { t: "revive", x: p.x, y: p.y, color: p.color, owner: p.id });
          }
        } else p.revive = Math.max(0, p.revive - dt * 1.5);
      }
      continue;
    }

    if (input.reload) startReload(p);
    predictMotion(p, input, dt, s.bunkers);
    if (p.reload > 0) {
      p.reload -= dt;
      const prog = clamp(1 - p.reload / PLAYER.reload, 0, 1);
      p.ammo = Math.min(p.mag, p.reloadFrom + Math.round((p.mag - p.reloadFrom) * prog));
      if (p.reload <= 0) { p.reload = 0; p.ammo = p.mag; }
    }
    p.fireT -= dt;
    if (input.fire) fire(s, p);
    if (p.rollerT > 0 && Math.hypot(p.vx, p.vy) > 60) {
      p.rollerTick -= dt;
      if (p.rollerTick <= 0) {
        p.rollerTick = 0.05;
        paintAt(s, p.x - p.vx * 0.03, p.y - p.vy * 0.03, COL.lime, 42, p.id);
      }
    }
  }

  // séparation douce entre coéquipiers
  if (s.players.length === 2) {
    const [a, b] = s.players;
    if (!a.down && !b.down) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r + 2;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

function spawnPoint(s: SimState) {
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(rand(s) * 4);
    const m = 70;
    const x = side === 1 ? WORLD.w - m : side === 3 ? m : rr(s, m, WORLD.w - m);
    const y = side === 0 ? m : side === 2 ? WORLD.h - m : rr(s, m, WORLD.h - m);
    const near = s.players.some((p) => !p.down && Math.hypot(p.x - x, p.y - y) < 190);
    if (!near && !inBunker(s, x, y, 30)) return { x, y };
  }
  return { x: WORLD.w / 2, y: 70 };
}

function startWave(s: SimState, n: number) {
  s.wave = n;
  const list: EType[] = [];
  const budget = 3 + Math.floor(n * 1.6);
  for (let i = 0; i < budget; i++) {
    const r = rand(s);
    if (n >= 3 && r < 0.2) list.push("sniper");
    else if (n >= 2 && r < 0.55) list.push("rusher");
    else list.push("grunt");
  }
  if (n % 5 === 0) list.unshift("boss");
  s.pending = list;
  s.maxAlive = clamp(5 + Math.floor(n * 1.2), 5, 12);
  s.spawnT = 0.5;
  ev(s, {
    t: "wave",
    text: n % 5 === 0 ? "BOSS" : "VAGUE " + n,
    sub: n % 5 === 0 ? "PRESSION MAXIMALE" : "À DEUX, C'EST MIEUX",
    color: n % 5 === 0 ? COL.boss : COL.chalk,
  });
}

function makeEnemy(s: SimState, type: EType, x: number, y: number): MpEnemy {
  const d = ENEMY_DEF[type];
  const scale = 1 + Math.min(0.55, (s.wave - 1) * 0.045);
  return {
    id: s.nextId++,
    type, x, y, vx: 0, vy: 0,
    r: d.r,
    hp: d.hp * scale,
    maxHp: d.hp * scale,
    angle: rr(s, 0, TAU),
    speed: d.speed * (1 + Math.min(0.35, (s.wave - 1) * 0.03)),
    fireT: rr(s, 0.6, 1.8),
    charge: 0,
    strafe: rand(s) < 0.5 ? -1 : 1,
    strafeT: rr(s, 1, 2.6),
    lungeT: 0,
    coolT: 0,
    flash: 0,
    volley: 0,
    stormT: 4,
    born: 0.35,
    slowT: 0,
  };
}

function enemyShoot(s: SimState, e: MpEnemy, spread: number, count: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const a = e.angle + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread) + rr(s, -0.04, 0.04);
    s.bullets.push({
      id: s.nextId++,
      x: e.x + Math.cos(a) * (e.r + 8),
      y: e.y + Math.sin(a) * (e.r + 8),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 5.5,
      dmg: 1,
      life: 2,
      color: ENEMY_DEF[e.type].color,
      foe: true,
      owner: null,
    });
  }
  ev(s, { t: "shot", x: e.x, y: e.y, angle: e.angle, color: ENEMY_DEF[e.type].color, owner: null });
}

function updateWaves(s: SimState, dt: number) {
  if (s.between > 0) {
    s.between -= dt;
    if (s.between <= 0) startWave(s, s.wave + 1);
    return;
  }
  if (s.pending.length) {
    s.spawnT -= dt;
    if (s.spawnT <= 0 && s.enemies.length < s.maxAlive) {
      const type = s.pending.shift()!;
      const pt = spawnPoint(s);
      s.enemies.push(makeEnemy(s, type, pt.x, pt.y));
      paintAt(s, pt.x, pt.y, ENEMY_DEF[type].color, 96, null);
      s.spawnT = clamp(1.15 - s.wave * 0.045, 0.35, 1.15) * rr(s, 0.7, 1.3);
    }
  } else if (!s.enemies.length) {
    const bonus = 220 * s.wave + Math.round(coverage(s) * 1400);
    s.teamScore += bonus;
    for (const p of s.players) {
      if (!p.down) p.hp = Math.min(p.maxHp, p.hp + 1);
      p.ammo = p.mag;
      p.reload = 0;
    }
    ev(s, { t: "wave", text: "VAGUE " + s.wave + " CLEAR", sub: "+" + bonus + " ÉQUIPE", color: COL.boss });
    s.between = 2.4;
  }
}

function updateEnemies(s: SimState, dt: number) {
  const targets = s.players.filter((p) => !p.down && p.connected);
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    e.born = Math.max(0, e.born - dt);
    e.flash = Math.max(0, e.flash - dt * 4);
    if (!targets.length) continue;
    let target = targets[0];
    let bd = 1e9;
    for (const p of targets) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bd) { bd = d; target = p; }
    }
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ax = dx / d;
    const ay = dy / d;
    const want = e.type === "rusher" ? 0 : e.type === "sniper" ? 330 : e.type === "boss" ? 250 : 235;
    e.angle = Math.atan2(dy, dx);
    let move = d > want + 30 ? 1 : d < want - 40 ? -0.9 : 0;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeT = rr(s, 0.9, 2.4); e.strafe *= -1; }
    const see = los(s, e, target);
    if (!see && d > 130) move = 1;
    let tvx = (ax * move - ay * e.strafe * 0.75) * e.speed;
    let tvy = (ay * move + ax * e.strafe * 0.75) * e.speed;
    if (e.type === "rusher") {
      tvx = ax * e.speed;
      tvy = ay * e.speed;
      e.lungeT -= dt;
      if (d < 150 && e.lungeT <= -0.6) { e.lungeT = 0.28; e.coolT = 0.4; }
      if (e.lungeT > 0) { tvx *= 2.1; tvy *= 2.1; }
      if (d < e.r + target.r + 6 && e.coolT <= 0) {
        e.coolT = 1.1;
        hurt(s, target, 1, e.x, e.y, COL.rusher);
        tvx = -ax * 220;
        tvy = -ay * 220;
      }
    }
    e.coolT -= dt;
    if (e.slowT > 0) {
      e.slowT = Math.max(0, e.slowT - dt);
      tvx *= INK_SLOW_FACTOR;
      tvy *= INK_SLOW_FACTOR;
    }
    const k = 1 - Math.exp(-(e.type === "rusher" ? 7 : 5) * dt);
    e.vx += (tvx - e.vx) * k;
    e.vy += (tvy - e.vy) * k;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    collide(s, e, e.r);

    if (e.born > 0) continue;
    if (e.type === "sniper") {
      if (e.charge > 0) {
        e.charge -= dt;
        if (e.charge <= 0 && see) enemyShoot(s, e, 0, 1, 900);
      } else {
        e.fireT -= dt;
        if (e.fireT <= 0 && see && d < 620) { e.charge = 0.62; e.fireT = rr(s, 1.5, 2.4); }
      }
    } else if (e.type === "boss") {
      e.stormT -= dt;
      if (e.volley > 0) {
        e.coolT -= dt;
        if (e.coolT <= 0) { e.volley--; e.coolT = 0.12; enemyShoot(s, e, 0.62, 5, 430); }
      } else if (e.stormT <= 0 && see) {
        e.stormT = rr(s, 4.6, 6.4);
        e.volley = 3;
        e.coolT = 0;
      } else {
        e.fireT -= dt;
        if (e.fireT <= 0 && see) { e.fireT = rr(s, 1.5, 2.3); enemyShoot(s, e, 0, 1, 430); }
      }
    } else if (e.type !== "rusher") {
      e.fireT -= dt;
      if (e.fireT <= 0 && (see || d < 200)) {
        e.fireT = clamp(rr(s, 1.3, 2.3) - s.wave * 0.03, 0.6, 2.3);
        enemyShoot(s, e, 0, 1, 430 + s.wave * 6);
      }
    }
  }
}

function killEnemy(s: SimState, idx: number, owner: MpPlayer | undefined) {
  const e = s.enemies[idx];
  s.enemies.splice(idx, 1);
  s.teamStreak++;
  s.comboT = 3.4;
  const mult = comboMult(s.teamStreak);
  const gain = Math.round(ENEMY_DEF[e.type].score * mult);
  s.teamScore += gain;
  if (owner) { owner.kills++; owner.score += gain; }
  paintAt(s, e.x, e.y, ENEMY_DEF[e.type].color, e.type === "boss" ? 190 : 104, owner?.id ?? null);
  ev(s, { t: "kill", x: e.x, y: e.y, color: ENEMY_DEF[e.type].color, amount: gain, text: "+" + gain + (mult > 1 ? " x" + mult : "") });
  if (rand(s) < (e.type === "boss" ? 1 : 0.28)) {
    const kinds = DROP_TABLE;
    s.pickups.push({ id: s.nextId++, x: e.x, y: e.y, kind: e.type === "boss" ? 1 : kinds[Math.floor(rand(s) * kinds.length)], t: 13 });
  }
}

function explode(s: SimState, x: number, y: number, color: string, owner?: MpPlayer) {
  const R = 95;
  paintAt(s, x, y, color, 150, owner?.id ?? null);
  ev(s, { t: "explode", x, y, color });
  if (s.mode === "versus") {
    for (const p of s.players) {
      if (p.id === owner?.id || p.down) continue;
      if (Math.hypot(p.x - x, p.y - y) < R + p.r) hurt(s, p, 1, x, y, color, owner);
    }
    return;
  }
  for (let j = s.enemies.length - 1; j >= 0; j--) {
    const e = s.enemies[j];
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > R + e.r) continue;
    e.hp -= 60;
    e.flash = 1;
    const a = Math.atan2(e.y - y, e.x - x);
    e.vx += Math.cos(a) * 220;
    e.vy += Math.sin(a) * 220;
    if (e.hp <= 0) killEnemy(s, j, owner);
  }
}

function updateBullets(s: SimState, dt: number) {
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.life -= dt;
    let gone = false;
    for (let step = 0; step < 3 && !gone; step++) {
      b.x += (b.vx * dt) / 3;
      b.y += (b.vy * dt) / 3;
      if (b.x < 4 || b.y < 4 || b.x > WORLD.w - 4 || b.y > WORLD.h - 4) {
        if (b.explosive) { explode(s, clamp(b.x, 8, WORLD.w - 8), clamp(b.y, 8, WORLD.h - 8), b.color, s.players.find((p) => p.id === b.owner)); b.explosive = false; }
        gone = true;
        break;
      }
      for (const bl of s.bunkers) {
        if (Math.abs(b.x - bl.x) > bl.w / 2 || Math.abs(b.y - bl.y) > bl.h / 2) continue;
        if (b.explosive) {
          explode(s, b.x, b.y, b.color, s.players.find((p) => p.id === b.owner));
          b.explosive = false;
          gone = true;
        } else if ((b.bounces ?? 0) > 0) {
          b.bounces = (b.bounces ?? 0) - 1;
          const dx = b.x - bl.x;
          const dy = b.y - bl.y;
          const px = bl.w / 2 + b.r - Math.abs(dx);
          const py = bl.h / 2 + b.r - Math.abs(dy);
          if (px < py) {
            const sign = dx >= 0 ? 1 : -1;
            b.x = bl.x + sign * (bl.w / 2 + b.r + 1);
            b.vx = Math.abs(b.vx) * sign;
          } else {
            const sign = dy >= 0 ? 1 : -1;
            b.y = bl.y + sign * (bl.h / 2 + b.r + 1);
            b.vy = Math.abs(b.vy) * sign;
          }
        } else {
          gone = true;
        }
        break;
      }
      if (gone) break;
      const owner = s.players.find((p) => p.id === b.owner);
      if (b.foe) {
        for (const p of s.players) {
          if (!p.down && Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
            hurt(s, p, b.dmg, b.x, b.y, b.color);
            gone = true;
            break;
          }
        }
      } else if (s.mode === "versus") {
        for (const p of s.players) {
          if (p.id !== b.owner && !p.down && Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
            if (owner) owner.hits++;
            if (owner && owner.inkT > 0 && p.slowT <= 0) p.slowT = INK_SLOW_DURATION;
            if (b.explosive) { explode(s, b.x, b.y, b.color, owner); b.explosive = false; }
            else hurt(s, p, b.dmg, b.x, b.y, b.color, owner);
            gone = true;
            break;
          }
        }
      } else {
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j];
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
            if (owner) owner.hits++;
            if (b.explosive) {
              explode(s, b.x, b.y, b.color, owner);
              b.explosive = false;
            } else {
              if (owner && owner.inkT > 0 && e.slowT <= 0) {
                e.slowT = INK_SLOW_DURATION;
                ev(s, { t: "hit", x: e.x, y: e.y, color: BONUS[9].color });
              }
              e.hp -= b.dmg;
              e.flash = 1;
              paintAt(s, b.x, b.y, b.color, 34, b.owner);
              ev(s, { t: "hit", x: b.x, y: b.y, color: b.color });
              if (e.hp <= 0) killEnemy(s, j, owner);
            }
            gone = true;
            break;
          }
        }
      }
    }
    if (gone || b.life <= 0) {
      if (b.explosive) { explode(s, b.x, b.y, b.color, s.players.find((p) => p.id === b.owner)); b.explosive = false; }
      paintAt(s, b.x, b.y, b.color, gone ? 30 : 34, b.owner);
      s.bullets.splice(i, 1);
    }
  }
  if (s.bullets.length > 260) s.bullets.splice(0, s.bullets.length - 260);
}

function updatePickups(s: SimState, dt: number) {
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const q = s.pickups[i];
    q.t -= dt;
    if (q.t <= 0) { s.pickups.splice(i, 1); continue; }
    for (const p of s.players) {
      if (p.magnetT > 0) {
        const mx = p.x - q.x;
        const my = p.y - q.y;
        const md = Math.hypot(mx, my) || 1;
        if (md < MAGNET_RADIUS) {
          const speed = MAGNET_SPEED * (1 - md / MAGNET_RADIUS);
          q.x = clamp(q.x + (mx / md) * speed * dt, 0, WORLD.w);
          q.y = clamp(q.y + (my / md) * speed * dt, 0, WORLD.h);
        }
      }
      if (p.down || Math.hypot(q.x - p.x, q.y - p.y) >= p.r + 18) continue;
      s.pickups.splice(i, 1);
      p.score += 60;
      s.teamScore += 60;
      const info = BONUS[q.kind];
      if (q.kind === 1) p.hp = Math.min(p.maxHp, p.hp + 2);
      else if (q.kind === 0) { p.ammo = p.mag; p.reload = 0; p.rapidT = 5; }
      else if (q.kind === 2) p.tripleT = 9;
      else if (q.kind === 3) { p.shield = 2; p.shieldT = 10; }
      else if (q.kind === 4) p.ricochetT = 8;
      else if (q.kind === 5) p.explosive = Math.min(2, p.explosive + 1);
      else if (q.kind === 6) p.rollerT = 6;
      else if (q.kind === 7) p.turboT = TURBO_DURATION;
      else if (q.kind === 8) p.cluster = Math.min(2, p.cluster + 1);
      else if (q.kind === 9) p.inkT = INK_DURATION;
      else if (q.kind === 10) p.magnetT = MAGNET_DURATION;
      ev(s, { t: "pickup", x: q.x, y: q.y, color: info.color, text: info.short });
      break;
    }
  }
}

function endMatch(s: SimState) {
  s.phase = "ended";
  if (s.mode === "versus") {
    const [a, b] = s.players;
    const sa = a ? finalScore(s, a) : 0;
    const sb = b ? finalScore(s, b) : 0;
    s.winner = sa === sb ? null : sa > sb ? a?.id ?? null : b?.id ?? null;
    const win = s.players.find((p) => p.id === s.winner);
    ev(s, { t: "end", text: win ? win.name + " GAGNE" : "ÉGALITÉ", sub: sa + " — " + sb, color: win?.color ?? COL.chalk });
  } else {
    s.winner = null;
    ev(s, { t: "end", text: "ÉQUIPE SPLATTÉE", sub: "VAGUE " + s.wave + " · " + s.teamScore + " PTS", color: COL.grunt });
  }
}

export function stepSim(s: SimState, dt = 1 / 60) {
  s.tick++;
  if (s.phase === "countdown") {
    s.countdown -= dt;
    if (s.countdown <= 0) {
      s.phase = "playing";
      if (s.mode === "coop") startWave(s, 1);
      else ev(s, { t: "wave", text: "PEINS OU SOIS PEINT", sub: "90 SECONDES", color: COL.chalk });
    }
    return;
  }
  if (s.phase !== "playing") return;
  s.time += dt;
  s.comboT = Math.max(0, s.comboT - dt);
  if (s.comboT === 0) s.teamStreak = 0;
  updatePlayers(s, dt);
  if (s.mode === "coop") {
    updateWaves(s, dt);
    updateEnemies(s, dt);
  } else {
    s.timeLeft -= dt;
  }
  updateBullets(s, dt);
  updatePickups(s, dt);

  if (s.mode === "coop") {
    if (s.players.every((p) => p.down || !p.connected)) endMatch(s);
  } else if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    endMatch(s);
  }
}

/** Copie sérialisable pour le réseau (pas de référence partagée). */
export function serialize(s: SimState): SimState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, token: undefined })),
    enemies: s.enemies.map((e) => ({ ...e })),
    bullets: s.bullets.map((b) => ({ ...b })),
    pickups: s.pickups.map((p) => ({ ...p })),
    events: [],
    bunkers: s.bunkers,
    owner: s.owner.slice(),
    ownerCells: [s.ownerCells[0], s.ownerCells[1]],
    pending: s.pending.slice(),
    inputs: {},
  };
}
