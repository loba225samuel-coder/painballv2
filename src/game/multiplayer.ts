/* Client multijoueur : duo local (même simulation) ou salon en ligne (autoritaire). */

import { Sfx } from "./audio";
import { BONUS, COL, ENEMY_DEF, PAINTS, TAU, WORLD, clamp } from "./rules";
import type { BonusKind } from "./rules";
import { addPlayer, coverage, createSim, defaultInput, drainEvents, finalScore, predictMotion, setInput, startMatch, stepSim } from "./mpSim";
import type { MpEvent, MpInput, MpMode, MpPhase, MpPlayer, SimState } from "./mpSim";
import { PROTOCOL_VERSION } from "./mpProtocol";
import type { ClientMsg, ServerMsg } from "./mpProtocol";

export type MpTransport = "local" | "online";
export type MpConnection = "local" | "offline" | "connecting" | "online" | "reconnecting";

export interface MpPower {
  id: string;
  name: string;
  pct: number;
  color: string;
  charges?: number;
}

export interface MpHudPlayer {
  id: string;
  name: string;
  slot: 0 | 1;
  color: string;
  hp: number;
  maxHp: number;
  ammo: number;
  mag: number;
  score: number;
  finalScore: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  down: boolean;
  revive: number;
  connected: boolean;
  ready: boolean;
  coverage: number;
  isMe: boolean;
  powers: MpPower[];
}

export interface MpHud {
  transport: MpTransport;
  connection: MpConnection;
  phase: MpPhase;
  mode: MpMode;
  code: string;
  hostId: string | null;
  meId: string;
  localPaused: boolean;
  countdown: number;
  wave: number;
  time: number;
  timeLeft: number;
  teamScore: number;
  combo: number;
  comboPct: number;
  enemies: number;
  coverage: number;
  ping: number;
  players: MpHudPlayer[];
  gamepads: number;
}

export interface MpResult {
  mode: MpMode;
  transport: MpTransport;
  winnerId: string | null;
  teamScore: number;
  wave: number;
  time: number;
  coverage: number;
  players: MpHudPlayer[];
}

interface Callbacks {
  onHud: (h: MpHud) => void;
  onResult: (r: MpResult) => void;
  onError: (msg: string) => void;
  onPauseIntent?: () => void;
}

interface Particle {
  kind: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text: string;
}

interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
  dur: number;
}

const DT = 1 / 60;
const PAD = 30;
const rnd = (a: number, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

export class MultiplayerGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  sfx = new Sfx(localStorage.getItem("pb.muted") === "1");

  private raf = 0;
  private last = 0;
  private acc = 0;
  private dead = false;
  private dpr = 1;
  private cssW = 1280;
  private cssH = 720;
  private camX = WORLD.w / 2;
  private camY = WORLD.h / 2;
  private camZoom = 1;
  private safe = { t: 0, r: 0, b: 0, l: 0 };

  private floor = document.createElement("canvas");
  private paint = document.createElement("canvas");
  private paintCtx!: CanvasRenderingContext2D;
  private splats = new Map<string, HTMLCanvasElement>();
  private glows = new Map<string, HTMLCanvasElement>();
  private splatV = 0;

  transport: MpTransport = "local";
  private sim: SimState = createSim("coop");
  private authoritative: SimState | null = null;
  private snapshotAt = 0;
  private localPaused = false;
  private resultSent = false;
  private lastEventId = 0;

  private parts: Particle[] = [];
  private banners: Banner[] = [];
  private trauma = 0;
  private flashAmt = 0;
  private flashCol = "#fff";
  private time = 0;
  private hudT = 0;

  // réseau
  private ws: WebSocket | null = null;
  private serverUrl = "";
  private connection: MpConnection = "offline";
  private meId = "";
  private code = "";
  private token = "";
  private ping = 0;
  private pingT = 0;
  private intentionalClose = false;
  private retries = 0;
  private reconnectTimer = 0;
  private pending: MpInput[] = [];
  private predPlayer: MpPlayer | null = null;
  private seq = 0;

  // entrées
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, used: false };
  private stickMove = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  private stickAim = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
  private btn = {
    fire: { x: 0, y: 0, r: 44, id: -1, press: 0 },
    dash: { x: 0, y: 0, r: 33, id: -1, press: 0 },
    reload: { x: 0, y: 0, r: 28, id: -1, press: 0 },
  };
  private isTouch = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)")?.matches;
  private vibe = localStorage.getItem("pb.vibe") !== "0";
  private gamepads = 0;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
    this.buildSprites();
    this.resize();
    this.mount();
    this.bakeFloor();
    this.loop();
  }

  /* ---------------- cycle de vie ---------------- */

  private mount() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("gamepadconnected", this.onPad);
    window.addEventListener("gamepaddisconnected", this.onPad);
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("contextmenu", this.prevent);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.reconnectTimer);
    this.intentionalClose = true;
    this.ws?.close();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("gamepadconnected", this.onPad);
    window.removeEventListener("gamepaddisconnected", this.onPad);
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("contextmenu", this.prevent);
  }

  private prevent = (e: Event) => e.preventDefault();
  private onPad = () => {
    this.gamepads = navigator.getGamepads?.().filter(Boolean).length ?? 0;
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
    this.stickMove.active = false;
    this.stickAim.active = false;
    if (this.transport === "local" && this.sim.phase === "playing") this.localPaused = true;
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Backspace" || (e.code === "Enter" && this.transport === "local")) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.transport === "local") this.togglePause();
      else this.cb.onPauseIntent?.();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  togglePause() {
    if (this.transport !== "local") return this.cb.onPauseIntent?.();
    if (this.sim.phase !== "playing" && !this.localPaused) return;
    this.localPaused = !this.localPaused;
    this.sfx.ui();
    this.emitHud();
  }
  resume() {
    this.localPaused = false;
    this.last = 0;
    this.emitHud();
  }

  private loop() {
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (ts: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    const now = ts / 1000;
    let dt = this.last ? now - this.last : DT;
    this.last = now;
    if (dt > 1 / 15) dt = 1 / 15;
    this.time += dt;
    this.onPad();

    if (this.transport === "local") {
      if (!this.localPaused && (this.sim.phase === "playing" || this.sim.phase === "countdown")) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= DT && steps < 5) {
          setInput(this.sim, "p1", this.readP1());
          setInput(this.sim, "p2", this.readP2());
          stepSim(this.sim, DT);
          this.acc -= DT;
          steps++;
        }
        this.applyEvents(drainEvents(this.sim));
        this.checkResult();
      }
    } else {
      this.sendInput();
      this.predict(dt);
      this.pingT -= dt;
      if (this.pingT <= 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.pingT = 2;
        this.send({ t: "ping", time: Date.now() });
      }
    }

    this.updateFx(dt);
    this.updateCamera(dt);
    this.draw();
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.emitHud();
    }
  };

  /* ---------------- modes ---------------- */

  startLocal(mode: MpMode) {
    this.closeNet();
    this.transport = "local";
    this.connection = "local";
    this.meId = "p1";
    this.code = "";
    this.sim = createSim(mode);
    addPlayer(this.sim, "p1", "JOUEUR 1");
    addPlayer(this.sim, "p2", "JOUEUR 2");
    startMatch(this.sim);
    this.localPaused = false;
    this.resultSent = false;
    this.lastEventId = 0;
    this.seq = 0;
    this.clearPaint();
    this.parts = [];
    this.banners = [];
    this.sfx.unlock();
    this.emitHud();
  }

  createRoom(name: string, mode: MpMode, url: string) {
    this.beginOnline(url, { t: "create", v: PROTOCOL_VERSION, name, mode });
  }
  joinRoom(code: string, name: string, url: string) {
    this.beginOnline(url, { t: "join", v: PROTOCOL_VERSION, name, code: code.toUpperCase().trim() });
  }
  resumeSession(url: string) {
    try {
      const raw = sessionStorage.getItem("pb.mp.session");
      if (!raw) return false;
      const s = JSON.parse(raw) as { code: string; id: string; token: string };
      if (!s.code || !s.id || !s.token) return false;
      this.beginOnline(url, { t: "rejoin", v: PROTOCOL_VERSION, code: s.code, id: s.id, token: s.token });
      return true;
    } catch {
      return false;
    }
  }

  private beginOnline(url: string, first: ClientMsg) {
    this.closeNet();
    if (!url) {
      this.cb.onError("Serveur multijoueur non configuré. Ajoutez VITE_MULTIPLAYER_URL (voir README).");
      return;
    }
    this.transport = "online";
    this.connection = "connecting";
    this.serverUrl = url;
    this.resultSent = false;
    this.lastEventId = 0;
    this.clearPaint();
    this.parts = [];
    this.banners = [];
    this.authoritative = null;
    this.predPlayer = null;
    this.pending = [];
    this.seq = 0;
    this.sim = createSim(first.t === "create" ? first.mode : "coop");
    this.intentionalClose = false;
    this.retries = 0;
    this.openSocket(first);
    this.sfx.unlock();
    this.emitHud();
  }

  private openSocket(first: ClientMsg) {
    try {
      this.ws = new WebSocket(this.serverUrl);
    } catch {
      this.connection = "offline";
      this.cb.onError("URL du serveur invalide.");
      return;
    }
    const ws = this.ws;
    ws.onopen = () => {
      this.retries = 0;
      this.send(first);
    };
    ws.onmessage = (e) => {
      try {
        this.onServer(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        /* message ignoré */
      }
    };
    ws.onerror = () => {
      if (this.connection === "connecting") this.cb.onError("Connexion impossible au serveur de salons.");
    };
    ws.onclose = () => {
      if (this.dead || this.intentionalClose) return;
      if (this.meId && this.code && this.token && this.retries < 6) {
        this.connection = "reconnecting";
        this.retries++;
        this.emitHud();
        this.reconnectTimer = window.setTimeout(() => {
          this.openSocket({ t: "rejoin", v: PROTOCOL_VERSION, code: this.code, id: this.meId, token: this.token });
        }, Math.min(5000, 600 * this.retries));
      } else {
        this.connection = "offline";
        this.emitHud();
      }
    };
  }

  private closeNet() {
    this.intentionalClose = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  leave() {
    if (this.transport === "online") this.send({ t: "leave" });
    sessionStorage.removeItem("pb.mp.session");
    this.closeNet();
    this.connection = "offline";
    this.authoritative = null;
    this.sim = createSim("coop");
    this.emitHud();
  }

  setReady(ready: boolean) {
    this.send({ t: "ready", ready });
  }
  requestStart() {
    if (this.transport === "local") return this.startLocal(this.sim.mode);
    this.send({ t: "start" });
  }
  private send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private onServer(msg: ServerMsg) {
    if (msg.t === "welcome") {
      this.meId = msg.id;
      this.token = msg.token;
      this.code = msg.code;
      this.connection = "online";
      sessionStorage.setItem("pb.mp.session", JSON.stringify({ code: msg.code, id: msg.id, token: msg.token }));
      this.emitHud();
    } else if (msg.t === "snapshot") {
      const prevPhase = this.authoritative?.phase;
      this.authoritative = msg.state;
      this.sim = msg.state;
      this.snapshotAt = performance.now();
      this.connection = "online";
      this.applyEvents(msg.events);
      this.reconcile(msg.ack[this.meId] ?? 0);
      if (msg.state.phase === "ended" && prevPhase !== "ended") this.checkResult();
      if (msg.state.phase === "countdown" && prevPhase !== "countdown") {
        this.clearPaint();
        this.resultSent = false;
      }
    } else if (msg.t === "pong") {
      this.ping = Math.max(0, Date.now() - msg.time);
    } else if (msg.t === "error") {
      this.cb.onError(msg.message);
      if (msg.fatal) {
        this.intentionalClose = true;
        this.connection = "offline";
        this.emitHud();
      }
    }
  }

  private state(): SimState {
    return this.transport === "local" ? this.sim : this.authoritative ?? this.sim;
  }

  private me(): MpPlayer | undefined {
    return this.state().players.find((p) => p.id === this.meId);
  }

  /* ---------------- entrées ---------------- */

  private screenToWorld(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return {
      px,
      py,
      x: (px - this.cssW / 2) / this.camZoom + this.camX,
      y: (py - this.cssH / 2) / this.camZoom + this.camY,
    };
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
    this.isTouch = true;
    const b = this.btn;
    const hit = (k: "fire" | "dash" | "reload") => Math.hypot(px - b[k].x, py - b[k].y) < b[k].r * 1.25;
    if (hit("fire")) { b.fire.id = e.pointerId; b.fire.press = 0.15; return this.capture(e.pointerId); }
    if (hit("dash")) { b.dash.id = e.pointerId; b.dash.press = 0.15; return this.capture(e.pointerId); }
    if (hit("reload")) { b.reload.id = e.pointerId; b.reload.press = 0.15; return this.capture(e.pointerId); }
    const left = px < this.cssW * 0.5;
    const st = left ? this.stickMove : this.stickAim;
    if (!st.active) {
      st.active = true;
      st.id = e.pointerId;
      st.ox = px;
      st.oy = py;
      st.dx = 0;
      st.dy = 0;
      if (!left) this.stickAim.mag = 0;
    }
    this.capture(e.pointerId);
  };
  private capture(id: number) {
    try { this.canvas.setPointerCapture(id); } catch { /* noop */ }
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
      if (!st.active || st.id !== e.pointerId) continue;
      let dx = px - st.ox;
      let dy = py - st.oy;
      let d = Math.hypot(dx, dy);
      if (d < 7) { dx = dy = d = 0; }
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; d = R; }
      st.dx = dx / R;
      st.dy = dy / R;
      if ("mag" in st) st.mag = Math.min(1, d / R);
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") { if (e.button === 0) this.mouse.down = false; return; }
    for (const k of ["fire", "dash", "reload"] as const) if (this.btn[k].id === e.pointerId) this.btn[k].id = -1;
    if (this.stickMove.id === e.pointerId) { this.stickMove.active = false; this.stickMove.id = -1; this.stickMove.dx = this.stickMove.dy = 0; }
    if (this.stickAim.id === e.pointerId) { this.stickAim.active = false; this.stickAim.id = -1; this.stickAim.dx = this.stickAim.dy = 0; this.stickAim.mag = 0; }
  };
  private get stickR() {
    return Math.round(clamp(Math.min(this.cssW, this.cssH) * 0.1, 40, 56));
  }

  private autoAim(p: MpPlayer, s: SimState) {
    let best: { x: number; y: number } | null = null;
    let bd = 1e9;
    if (s.mode === "versus") {
      const foe = s.players.find((q) => q.id !== p.id && !q.down);
      if (foe) best = foe;
    } else {
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; best = e; }
      }
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : p.angle;
  }

  private readP1(): MpInput {
    const s = this.state();
    const p = s.players.find((q) => q.id === this.meId) ?? s.players[0];
    let mx = 0, my = 0;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight") && this.transport !== "local") mx += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft") && this.transport !== "local") mx -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown") && this.transport !== "local") my += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp") && this.transport !== "local") my -= 1;
    if (this.stickMove.active) { mx += this.stickMove.dx; my += this.stickMove.dy; }
    let aim = p?.angle ?? 0;
    let fire = this.mouse.down || this.keys.has("Space") || this.btn.fire.id !== -1 || (this.stickAim.active && this.stickAim.mag > 0.4);
    if (this.stickAim.active && this.stickAim.mag > 0.12) aim = Math.atan2(this.stickAim.dy, this.stickAim.dx);
    else if (this.mouse.used) aim = Math.atan2(this.mouse.y - (p?.y ?? 0), this.mouse.x - (p?.x ?? 0));
    else if (p) aim = this.autoAim(p, s);
    const dash = this.keys.has("ShiftLeft") || this.btn.dash.id !== -1;
    const reload = this.keys.has("KeyR") || this.btn.reload.id !== -1;
    // manette 1 si deux manettes, sinon la manette sert au J2
    const pads = navigator.getGamepads?.() ?? [];
    const padIndex = this.gamepads >= 2 ? 0 : -1;
    const pad = padIndex >= 0 ? pads[padIndex] : null;
    if (pad) {
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { mx += ax; my += ay; }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.2) aim = Math.atan2(ry, rx);
      fire = fire || !!pad.buttons[0]?.pressed || !!pad.buttons[7]?.pressed;
    }
    return { seq: ++this.seq, mx: clamp(mx, -1, 1), my: clamp(my, -1, 1), aim, fire, dash, reload };
  }

  private readP2(): MpInput {
    const s = this.sim;
    const p = s.players[1];
    let mx = 0, my = 0;
    if (this.keys.has("ArrowRight")) mx += 1;
    if (this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("ArrowUp")) my -= 1;
    let ax = 0, ay = 0;
    if (this.keys.has("KeyL")) ax += 1;
    if (this.keys.has("KeyJ")) ax -= 1;
    if (this.keys.has("KeyK")) ay += 1;
    if (this.keys.has("KeyI")) ay -= 1;
    let aim = p?.angle ?? Math.PI;
    let fire = this.keys.has("Enter") || this.keys.has("NumpadEnter");
    let dash = this.keys.has("ShiftRight");
    let reload = this.keys.has("Backspace") || this.keys.has("Numpad0");
    const pads = navigator.getGamepads?.() ?? [];
    const pad = this.gamepads >= 2 ? pads[1] : pads[0];
    if (pad) {
      const lx = pad.axes[0] ?? 0, ly = pad.axes[1] ?? 0;
      if (Math.hypot(lx, ly) > 0.2) { mx += lx; my += ly; }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.2) aim = Math.atan2(ry, rx);
      else if (p) aim = this.autoAim(p, s);
      fire = fire || !!pad.buttons[0]?.pressed || !!pad.buttons[7]?.pressed;
      dash = dash || !!pad.buttons[1]?.pressed || !!pad.buttons[6]?.pressed;
      reload = reload || !!pad.buttons[2]?.pressed;
    } else if (Math.hypot(ax, ay) > 0.1) aim = Math.atan2(ay, ax);
    else if (p) aim = this.autoAim(p, s);
    return { seq: 0, mx: clamp(mx, -1, 1), my: clamp(my, -1, 1), aim, fire, dash, reload };
  }

  private sendInput() {
    if (this.connection !== "online" || !this.meId) return;
    const input = this.readP1();
    this.pending.push(input);
    if (this.pending.length > 120) this.pending.shift();
    this.send({ t: "input", input });
  }

  private predict(dt: number) {
    const s = this.authoritative;
    const me = this.me();
    if (!s || !me) return;
    if (!this.predPlayer) this.predPlayer = { ...me };
    this.predPlayer.hp = me.hp;
    this.predPlayer.ammo = me.ammo;
    this.predPlayer.reload = me.reload;
    this.predPlayer.down = me.down;
    this.predPlayer.invuln = me.invuln;
    this.predPlayer.shield = me.shield;
    this.predPlayer.shieldT = me.shieldT;
    this.predPlayer.explosive = me.explosive;
    this.predPlayer.ricochetT = me.ricochetT;
    this.predPlayer.rollerT = me.rollerT;
    const input = this.pending[this.pending.length - 1] ?? defaultInput();
    this.predPlayer.angle = input.aim;
    predictMotion(this.predPlayer, input, dt, s.bunkers);
  }

  private reconcile(ack: number) {
    const s = this.authoritative;
    const me = this.me();
    if (!s || !me) return;
    this.pending = this.pending.filter((i) => i.seq > ack);
    this.predPlayer = { ...me };
    for (const input of this.pending) predictMotion(this.predPlayer, input, DT, s.bunkers);
  }

  /* ---------------- effets ---------------- */

  private buzz(ms: number | number[]) {
    if (!this.vibe) return;
    try { navigator.vibrate?.(ms); } catch { /* noop */ }
  }
  toggleMute() {
    const m = !this.sfx.muted;
    this.sfx.setMuted(m);
    localStorage.setItem("pb.muted", m ? "1" : "0");
    return m;
  }
  toggleVibe() {
    this.vibe = !this.vibe;
    localStorage.setItem("pb.vibe", this.vibe ? "1" : "0");
    if (this.vibe) this.buzz(20);
    return this.vibe;
  }
  get vibeOn() { return this.vibe; }

  private part(p: Partial<Particle> & { x: number; y: number }) {
    if (this.parts.length > 420) return;
    this.parts.push({ kind: 0, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 3, color: COL.chalk, text: "", ...p } as Particle);
  }
  private spray(x: number, y: number, color: string, n: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU);
      const v = spd * rnd(0.3, 1.1);
      this.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.25, 0.6), max: 0.6, size: rnd(2, 5), color });
    }
  }
  private ring(x: number, y: number, color: string, size: number) {
    this.part({ kind: 2, x, y, life: 0.34, max: 0.34, size, color });
  }
  private popText(x: number, y: number, text: string, color: string, size = 20) {
    this.part({ kind: 3, x, y, vy: -46, life: 0.9, max: 0.9, text, color, size });
  }
  private banner(text: string, sub: string, color: string, dur = 1.5) {
    this.banners.push({ text, sub, color, t: 0, dur });
    if (this.banners.length > 3) this.banners.shift();
  }

  private applyEvents(events: MpEvent[]) {
    for (const e of events) {
      if (e.id <= this.lastEventId) continue;
      this.lastEventId = e.id;
      const mine = "owner" in e && e.owner === this.meId;
      if (e.t === "paint") this.splat(e.x, e.y, e.color, e.size);
      else if (e.t === "shot") {
        this.spray(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22, e.color, 3, 120);
        if (mine || this.transport === "local") this.sfx.shoot();
      } else if (e.t === "hit") {
        this.spray(e.x, e.y, e.color, 5, 160);
        this.sfx.hit();
      } else if (e.t === "kill") {
        this.splat(e.x, e.y, e.color, 104);
        this.spray(e.x, e.y, e.color, 24, 300);
        this.ring(e.x, e.y, e.color, 80);
        this.popText(e.x, e.y - 18, e.text, e.color, 22);
        this.trauma = Math.min(1, this.trauma + 0.3);
        this.sfx.kill();
        if (mine) this.buzz(10);
      } else if (e.t === "hurt") {
        this.spray(e.x, e.y, e.color, 14, 240);
        if (mine || this.transport === "local") {
          this.trauma = Math.min(1, this.trauma + 0.55);
          this.flashAmt = 0.35;
          this.flashCol = e.color;
          this.sfx.hurt();
          if (mine) this.buzz([0, 30, 24, 46]);
        }
      } else if (e.t === "down") {
        this.splat(e.x, e.y, e.color, 150);
        this.spray(e.x, e.y, e.color, 40, 400);
        this.ring(e.x, e.y, "#ffffff", 140);
        this.trauma = 1;
        this.sfx.over();
        if (mine) this.buzz([0, 90, 50, 180]);
      } else if (e.t === "revive") {
        this.ring(e.x, e.y, e.color, 70);
        this.popText(e.x, e.y - 24, "DEBOUT !", e.color, 20);
        this.sfx.pickup();
      } else if (e.t === "dash") {
        this.ring(e.x, e.y, e.color, 46);
      } else if (e.t === "shield") {
        this.ring(e.x, e.y, "#7ef4ff", 64);
        this.spray(e.x, e.y, "#7ef4ff", 12, 220);
        if (mine || this.transport === "local") {
          this.popText(e.x, e.y - 26, "BOUCLIER", "#7ef4ff", 18);
          this.sfx.hit();
          this.buzz(12);
        }
      } else if (e.t === "explode") {
        this.splat(e.x, e.y, e.color, 150);
        this.spray(e.x, e.y, e.color, 34, 380);
        this.ring(e.x, e.y, COL.rusher, 130);
        this.trauma = Math.min(1, this.trauma + 0.5);
        this.flashAmt = 0.2;
        this.flashCol = COL.rusher;
        this.sfx.splat();
      } else if (e.t === "pickup") {
        this.ring(e.x, e.y, e.color, 54);
        this.popText(e.x, e.y - 12, e.text, e.color, 18);
        this.sfx.pickup();
      } else if (e.t === "wave") {
        this.banner(e.text, e.sub, e.color, 1.6);
        this.sfx.wave();
      } else if (e.t === "end") {
        this.banner(e.text, e.sub, e.color, 2.4);
      }
    }
  }

  private updateFx(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 3.2);
    for (const k of ["fire", "dash", "reload"] as const) this.btn[k].press = Math.max(0, this.btn[k].press - dt);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === 0) { q.vx *= 1 - 3.4 * dt; q.vy *= 1 - 3.4 * dt; }
      if (q.kind === 3) q.vy *= 1 - 2.2 * dt;
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].t += dt;
      if (this.banners[i].t > this.banners[i].dur) this.banners.splice(i, 1);
    }
  }

  private checkResult() {
    const s = this.state();
    if (s.phase !== "ended" || this.resultSent) return;
    this.resultSent = true;
    this.cb.onResult(this.resultFrom(s));
  }

  private resultFrom(s: SimState): MpResult {
    return {
      mode: s.mode,
      transport: this.transport,
      winnerId: s.winner,
      teamScore: s.teamScore,
      wave: s.wave,
      time: s.time,
      coverage: coverage(s),
      players: s.players.map((p) => this.hudPlayer(p, s)),
    };
  }

  private hudPlayer(p: MpPlayer, s: SimState): MpHudPlayer {
    const cells = s.ownerCells[p.slot] ?? 0;
    const powers: MpPower[] = [];
    if (p.rapidT > 0) powers.push({ id: "rapid", name: "OVERCLOCK", pct: p.rapidT / 5, color: COL.player });
    if (p.tripleT > 0) powers.push({ id: "triple", name: "TRIPLE", pct: p.tripleT / 9, color: COL.boss });
    if (p.shield > 0) powers.push({ id: "shield", name: "BOUCLIER", pct: p.shieldT / 10, color: "#7ef4ff", charges: p.shield });
    if (p.ricochetT > 0) powers.push({ id: "ricochet", name: "RICOCHET", pct: p.ricochetT / 8, color: COL.sniper });
    if (p.explosive > 0) powers.push({ id: "explosive", name: "EXPLOSIF", pct: 1, color: COL.rusher, charges: p.explosive });
    if (p.rollerT > 0) powers.push({ id: "roller", name: "ROULEAU", pct: p.rollerT / 6, color: COL.lime });
    return {
      id: p.id,
      name: p.name,
      slot: p.slot,
      color: p.color,
      hp: p.hp,
      maxHp: p.maxHp,
      ammo: p.ammo,
      mag: p.mag,
      score: p.score,
      finalScore: finalScore(s, p),
      kills: p.kills,
      deaths: p.deaths,
      shots: p.shots,
      hits: p.hits,
      down: p.down,
      revive: p.revive,
      connected: p.connected,
      ready: p.ready,
      coverage: cells / Math.max(1, s.gw * s.gh),
      isMe: p.id === this.meId,
      powers,
    };
  }

  private emitHud() {
    const s = this.state();
    this.cb.onHud({
      transport: this.transport,
      connection: this.connection,
      phase: s.phase,
      mode: s.mode,
      code: this.code,
      hostId: s.hostId,
      meId: this.meId,
      localPaused: this.localPaused,
      countdown: s.countdown,
      wave: s.wave,
      time: s.time,
      timeLeft: s.timeLeft,
      teamScore: s.teamScore,
      combo: this.comboMult(s.teamStreak),
      comboPct: clamp(s.comboT / 3.4, 0, 1),
      enemies: s.enemies.length + s.pending.length,
      coverage: coverage(s),
      ping: this.ping,
      players: s.players.map((p) => this.hudPlayer(p, s)),
      gamepads: this.gamepads,
    });
  }
  private comboMult(streak: number) {
    let m = 1;
    for (const [i, n] of [2, 4, 7, 11, 16, 22].entries()) if (streak >= n) m = 2 + i;
    return m;
  }

  /* ---------------- rendu ---------------- */

  resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const rect = host.getBoundingClientRect();
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const cssW = Math.max(280, Math.round(rect.width || vw));
    const cssH = Math.max(240, Math.round(rect.height || vh));
    const raw = window.devicePixelRatio || 1;
    this.dpr = cssW * cssH > 1_350_000 ? Math.min(1.25, raw) : Math.min(2, raw);
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    try {
      const cs = getComputedStyle(document.documentElement);
      this.safe.t = parseFloat(cs.getPropertyValue("--sa-t")) || 0;
      this.safe.r = parseFloat(cs.getPropertyValue("--sa-r")) || 0;
      this.safe.b = parseFloat(cs.getPropertyValue("--sa-b")) || 0;
      this.safe.l = parseFloat(cs.getPropertyValue("--sa-l")) || 0;
    } catch { /* noop */ }
    const cover = Math.max(cssW / WORLD.w, cssH / WORLD.h);
    // pas de transition sous le cover : sinon une bande noire apparaît à la rotation
    this.camZoom = cover * (this.isTouch ? 1.1 : 1);
    const b = this.btn;
    b.fire.r = Math.round(clamp(Math.min(Math.min(cssW, cssH) * 0.09, cssH * 0.13), 30, 46));
    b.fire.x = cssW - b.fire.r - 14 - this.safe.r;
    b.fire.y = cssH - b.fire.r - 14 - this.safe.b;
    b.dash.r = b.fire.r * 0.78;
    b.dash.x = b.fire.x - b.fire.r - b.dash.r - 8;
    b.dash.y = b.fire.y - b.fire.r * 0.42;
    b.reload.r = b.fire.r * 0.64;
    b.reload.x = b.fire.x - b.fire.r * 0.34;
    b.reload.y = b.fire.y - b.fire.r - b.reload.r - 6;
  }

  /** Caméra plein écran : plus de bandes noires, on suit l'action. */
  private updateCamera(dt: number) {
    const s = this.state();
    const cover = Math.max(this.cssW / WORLD.w, this.cssH / WORLD.h);
    let targetZoom = cover * (this.isTouch ? 1.1 : 1);
    let tx = WORLD.w / 2;
    let ty = WORLD.h / 2;
    const alive = s.players.filter((p) => !p.down);
    if (this.transport === "online") {
      const me = this.predPlayer ?? this.me();
      if (me) { tx = me.x; ty = me.y; }
    } else if (alive.length) {
      tx = alive.reduce((a, p) => a + p.x, 0) / alive.length;
      ty = alive.reduce((a, p) => a + p.y, 0) / alive.length;
      if (alive.length === 2) {
        const dx = Math.abs(alive[0].x - alive[1].x) + 420;
        const dy = Math.abs(alive[0].y - alive[1].y) + 320;
        const fit = Math.min(this.cssW / dx, this.cssH / dy);
        targetZoom = clamp(Math.min(targetZoom, fit), cover, cover * 1.15);
      }
    }
    const viewW = this.cssW / targetZoom;
    const viewH = this.cssH / targetZoom;
    const cx = viewW >= WORLD.w ? WORLD.w / 2 : clamp(tx, viewW / 2, WORLD.w - viewW / 2);
    const cy = viewH >= WORLD.h ? WORLD.h / 2 : clamp(ty, viewH / 2, WORLD.h - viewH / 2);
    const k = 1 - Math.exp(-9 * dt);
    this.camZoom += (targetZoom - this.camZoom) * k;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
  }

  private worldToScreen(x: number, y: number) {
    return {
      x: (x - this.camX) * this.camZoom + this.cssW / 2,
      y: (y - this.camY) * this.camZoom + this.cssH / 2,
    };
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, s: SimState) {
    const mw = clamp(this.cssW * 0.2, 84, 150);
    const mh = (mw * WORLD.h) / WORLD.w;
    const mx = this.cssW / 2 - mw / 2;
    const portrait = this.cssH > this.cssW;
    const my = portrait ? this.cssH - mh - 118 - this.safe.b : 10 + this.safe.t;
    const k = mw / WORLD.w;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = "rgba(5,16,13,0.78)";
    ctx.strokeStyle = "rgba(44,71,64,0.95)";
    ctx.lineWidth = 2;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#2c4740";
    for (const b of s.bunkers) ctx.fillRect(mx + (b.x - b.w / 2) * k, my + (b.y - b.h / 2) * k, b.w * k, b.h * k);
    // viewport
    const vw = this.cssW / this.camZoom;
    const vh = this.cssH / this.camZoom;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = COL.chalk;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (this.camX - vw / 2) * k, my + (this.camY - vh / 2) * k, vw * k, vh * k);
    ctx.globalAlpha = 0.95;
    for (const e of s.enemies) {
      ctx.fillStyle = ENEMY_DEF[e.type].color;
      ctx.fillRect(mx + e.x * k - 1.5, my + e.y * k - 1.5, 3, 3);
    }
    for (const p of s.players) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(mx + p.x * k, my + p.y * k, p.id === this.meId || this.transport === "local" ? 3 : 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = COL.chalk;
    ctx.font = "700 8px 'Barlow Semi Condensed', Barlow, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("CARTE", mx + 4, my + 3);
    ctx.restore();
  }

  private drawOffscreen(ctx: CanvasRenderingContext2D, s: SimState) {
    const m = 26;
    const marks: { x: number; y: number; color: string; big: boolean }[] = [];
    for (const e of s.enemies) marks.push({ x: e.x, y: e.y, color: ENEMY_DEF[e.type].color, big: e.type === "boss" });
    for (const p of s.players) {
      if (this.transport === "online" && p.id === this.meId) continue;
      marks.push({ x: p.x, y: p.y, color: p.color, big: true });
    }
    let n = 0;
    for (const q of marks) {
      if (n > 10) break;
      const pt = this.worldToScreen(q.x, q.y);
      if (pt.x > m && pt.x < this.cssW - m && pt.y > m && pt.y < this.cssH - m) continue;
      const cx = clamp(pt.x, m, this.cssW - m);
      const cy = clamp(pt.y, m, this.cssH - m);
      const a = Math.atan2(pt.y - this.cssH / 2, pt.x - this.cssW / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = q.color;
      ctx.strokeStyle = "#05100d";
      ctx.lineWidth = 2;
      const r = q.big ? 10 : 7;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, -r * 0.7);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      n++;
    }
    ctx.globalAlpha = 1;
  }

  private buildSprites() {
    const S = 80;
    for (const c of [...PAINTS, COL.player, COL.lime, "#ffffff", "#7ef4ff"]) {
      for (let v = 0; v < 4; v++) {
        const cv = document.createElement("canvas");
        cv.width = cv.height = S;
        const g = cv.getContext("2d")!;
        g.fillStyle = c;
        g.strokeStyle = c;
        g.lineCap = "round";
        g.beginPath();
        g.arc(S / 2, S / 2, S * 0.17, 0, TAU);
        g.fill();
        const n = 6 + (v % 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + v + rnd(0.5);
          const len = S * rnd(0.12, 0.34);
          const px = S / 2 + Math.cos(a) * (S * 0.14 + len);
          const py = S / 2 + Math.sin(a) * (S * 0.14 + len);
          g.lineWidth = S * rnd(0.05, 0.1);
          g.beginPath();
          g.moveTo(S / 2 + Math.cos(a) * S * 0.08, S / 2 + Math.sin(a) * S * 0.08);
          g.lineTo(px, py);
          g.stroke();
          g.beginPath();
          g.arc(px, py, S * rnd(0.03, 0.07), 0, TAU);
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

  private clearPaint() {
    this.paint.width = WORLD.w;
    this.paint.height = WORLD.h;
    this.paintCtx = this.paint.getContext("2d")!;
    this.paintCtx.clearRect(0, 0, WORLD.w, WORLD.h);
  }

  private splat(x: number, y: number, color: string, size: number) {
    if (!this.paintCtx || x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return;
    const sp = this.splats.get(color + "|" + (this.splatV++ % 4)) ?? this.splats.get(PAINTS[0] + "|0")!;
    const g = this.paintCtx;
    g.save();
    g.globalAlpha = 0.9;
    g.translate(x, y);
    g.rotate(rnd(TAU));
    g.drawImage(sp, -size / 2, -size / 2, size, size);
    g.restore();
  }

  private rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const q = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + q, y);
    g.arcTo(x + w, y, x + w, y + h, q);
    g.arcTo(x + w, y + h, x, y + h, q);
    g.arcTo(x, y + h, x, y, q);
    g.arcTo(x, y, x + w, y, q);
    g.closePath();
  }

  private bakeFloor() {
    const W = WORLD.w, H = WORLD.h;
    this.floor.width = W + PAD * 2;
    this.floor.height = H + PAD * 2;
    const g = this.floor.getContext("2d")!;
    g.fillStyle = "#050c0a";
    g.fillRect(0, 0, this.floor.width, this.floor.height);
    g.save();
    g.translate(PAD, PAD);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#1d302a");
    grd.addColorStop(0.5, "#223930");
    grd.addColorStop(1, "#182723");
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(233,245,238,0.035)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 58) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 58) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(233,245,238,0.035)";
      g.fillRect(rnd(W), rnd(H), rnd(0.6, 2.2), rnd(0.6, 2.2));
    }
    g.strokeStyle = "rgba(233,245,238,0.32)";
    g.lineWidth = 4;
    g.strokeRect(28, 28, W - 56, H - 56);
    g.strokeStyle = "rgba(233,245,238,0.16)";
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2, 28); g.lineTo(W / 2, H - 28); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 110, 0, TAU); g.stroke();
    g.globalAlpha = 0.05;
    g.fillStyle = "#e9f5ee";
    g.font = "700 120px Bungee, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("DUO", W / 2, H / 2);
    g.globalAlpha = 1;
    for (const b of this.sim.bunkers) {
      const x = b.x - b.w / 2, y = b.y - b.h / 2;
      g.fillStyle = "rgba(0,0,0,0.4)";
      this.rr(g, x + 7, y + 11, b.w, b.h, 9); g.fill();
      const bg = g.createLinearGradient(x, y, x, y + b.h);
      bg.addColorStop(0, "#6e6448"); bg.addColorStop(0.55, "#565038"); bg.addColorStop(1, "#3d3a29");
      g.fillStyle = bg;
      this.rr(g, x, y, b.w, b.h, 9); g.fill();
      g.strokeStyle = "#131d19"; g.lineWidth = 3;
      this.rr(g, x, y, b.w, b.h, 9); g.stroke();
      g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 6, y + b.h / 2); g.lineTo(x + b.w - 6, y + b.h / 2); g.stroke();
      for (let i = 0; i < 3; i++) {
        const sp = this.splats.get(PAINTS[(Math.random() * PAINTS.length) | 0] + "|" + ((Math.random() * 4) | 0))!;
        const size = rnd(20, 42);
        g.globalAlpha = 0.8;
        g.drawImage(sp, x + rnd(b.w) - size / 2, y + rnd(b.h) - size / 2, size, size);
        g.globalAlpha = 1;
      }
    }
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    g.restore();
    g.strokeStyle = "rgba(255,216,77,0.4)";
    g.lineWidth = 9;
    g.setLineDash([17, 13]);
    g.strokeRect(PAD - 9, PAD - 9, W + 18, H + 18);
    g.setLineDash([]);
    this.clearPaint();
  }

  private draw() {
    const ctx = this.ctx;
    const s = this.state();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#050c0a";
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const sh = this.trauma * this.trauma * 16;
    const sx = Math.cos(this.time * 47) * sh;
    const sy = Math.sin(this.time * 39) * sh;
    ctx.save();
    ctx.translate(this.cssW / 2 + sx, this.cssH / 2 + sy);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);
    ctx.drawImage(this.floor, -PAD, -PAD);
    ctx.drawImage(this.paint, 0, 0);

    // territoire VERSUS : teinte très légère des cases peintes
    if (s.mode === "versus") {
      for (let i = 0; i < s.owner.length; i++) {
        const o = s.owner[i];
        if (!o) continue;
        const p = s.players.find((q) => q.slot === o - 1);
        if (!p) continue;
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = p.color;
        ctx.fillRect((i % s.gw) * s.cell, Math.floor(i / s.gw) * s.cell, s.cell, s.cell);
      }
      ctx.globalAlpha = 1;
    }

    const age = this.transport === "online" ? clamp((performance.now() - this.snapshotAt) / 1000, 0, 0.12) : 0;
    for (const q of s.pickups) this.drawPickup(ctx, q.x, q.y, q.kind, q.t);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    for (const e of s.enemies) { ctx.beginPath(); ctx.ellipse(e.x + 4, e.y + 7, e.r, e.r * 0.6, 0, 0, TAU); ctx.fill(); }
    for (const p of s.players) { ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 8, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill(); }
    for (const e of s.enemies) this.drawEnemy(ctx, e.x + e.vx * age * 0.5, e.y + e.vy * age * 0.5, e);
    for (const p of s.players) {
      const isLocalMe = this.transport === "online" && p.id === this.meId && this.predPlayer;
      const rp = isLocalMe ? this.predPlayer! : p;
      const x = isLocalMe ? rp.x : p.x + p.vx * age;
      const y = isLocalMe ? rp.y : p.y + p.vy * age;
      this.drawPlayer(ctx, x, y, rp, p.id === this.meId || this.transport === "local");
    }
    for (const b of s.bullets) this.drawBullet(ctx, b.x + b.vx * age, b.y + b.vy * age, b.vx, b.vy, b.color);
    this.drawParticles(ctx);
    if (this.transport === "online" && this.mouse.used && !this.isTouch) this.drawReticle(ctx);
    ctx.restore();
    this.drawScreen(ctx, s);
  }

  private drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, color: string) {
    const glow = this.glows.get(color);
    if (glow) { ctx.globalAlpha = 0.7; ctx.drawImage(glow, x - 14, y - 14, 28, 28); ctx.globalAlpha = 1; }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(2, 0, 2.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: BonusKind, t: number) {
    const info = BONUS[kind];
    const col = info.color;
    ctx.save();
    ctx.translate(x, y + Math.sin(this.time * 5 + x) * 3);
    const glow = this.glows.get(col);
    if (glow) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(glow, -30, -30, 60, 60);
      ctx.globalAlpha = 1;
    }
    if (t < 3) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 9));
    ctx.fillStyle = "#0b1210";
    this.rr(ctx, -14, -12, 28, 24, 5); ctx.fill();
    ctx.fillStyle = col;
    this.rr(ctx, -12, -10, 24, 20, 4); ctx.fill();
    ctx.strokeStyle = "#0b1210";
    ctx.fillStyle = "#0b1210";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (kind === 0) {
      ctx.font = "800 13px Barlow, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(">>", 0, 1);
    } else if (kind === 1) {
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    } else if (kind === 2) {
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, 0, 2.2, 0, TAU); ctx.fill(); }
    } else if (kind === 3) {
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, -3); ctx.lineTo(6, 2); ctx.quadraticCurveTo(6, 6, 0, 8); ctx.quadraticCurveTo(-6, 6, -6, 2); ctx.lineTo(-6, -3); ctx.closePath(); ctx.stroke();
    } else if (kind === 4) {
      ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(0, -4); ctx.lineTo(6, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(6, -4); ctx.lineTo(6, -1); ctx.stroke();
    } else if (kind === 5) {
      ctx.beginPath(); ctx.arc(0, 2, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, -3); ctx.quadraticCurveTo(5, -7, 7, -5); ctx.stroke();
    } else {
      ctx.fillRect(-7, -5, 10, 6);
      ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(7, -2); ctx.lineTo(7, 5); ctx.stroke();
    }
    ctx.font = "800 9px 'Barlow Semi Condensed', Barlow, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,16,13,0.9)";
    ctx.strokeText(info.short, 0, 15);
    ctx.fillStyle = col;
    ctx.fillText(info.short, 0, 15);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, e: { type: string; r: number; angle: number; flash: number; hp: number; maxHp: number; charge?: number }) {
    const col = ENEMY_DEF[e.type as keyof typeof ENEMY_DEF]?.color ?? COL.grunt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.angle);
    const body = e.flash > 0.05 ? "#fff" : col;
    if (e.type === "rusher") {
      ctx.fillStyle = "#0b1210";
      ctx.beginPath(); ctx.moveTo(e.r + 8, 0); ctx.lineTo(-e.r, -e.r - 2); ctx.lineTo(-e.r, e.r + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(e.r + 3, 0); ctx.lineTo(-e.r + 4, -e.r + 2); ctx.lineTo(-e.r + 4, e.r - 2); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#132019";
      this.rr(ctx, 5, -4, e.type === "sniper" ? 32 : 22, 8, 3); ctx.fill();
      ctx.fillStyle = "#0b1210";
      this.rr(ctx, -e.r - 1, -e.r - 1, (e.r + 1) * 2, (e.r + 1) * 2, 9); ctx.fill();
      ctx.fillStyle = body;
      this.rr(ctx, -e.r + 2, -e.r + 2, (e.r - 2) * 2, (e.r - 2) * 2, 7); ctx.fill();
      ctx.fillStyle = "#0f1c18";
      ctx.beginPath(); ctx.arc(3, 0, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(5, 0, 3.6, 5, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (e.type === "sniper" && (e.charge ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(e.angle) * 900, y + Math.sin(e.angle) * 900); ctx.stroke();
      ctx.restore();
    }
    if (e.hp < e.maxHp) {
      const w = e.r * 2.2;
      ctx.fillStyle = "rgba(5,16,13,0.75)";
      ctx.fillRect(x - w / 2 - 1, y - e.r - 13, w + 2, 5);
      ctx.fillStyle = "#e9f5ee";
      ctx.fillRect(x - w / 2, y - e.r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, p: MpPlayer, showRing: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (p.down) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(0, 0, p.r + 10, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = p.color;
      ctx.font = "800 13px Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("À TERRE", 0, -p.r - 18);
      if (p.revive > 0) {
        ctx.strokeStyle = COL.lime;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, p.r + 16, -Math.PI / 2, -Math.PI / 2 + clamp(p.revive / 1.5, 0, 1) * TAU); ctx.stroke();
      }
      ctx.rotate(Math.PI / 2);
    }
    const blink = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
    const gl = this.glows.get(p.color);
    if (gl) { ctx.globalAlpha = blink ? 0.25 : 0.5; ctx.drawImage(gl, -38, -38, 76, 76); ctx.globalAlpha = blink ? 0.45 : 1; }
    if (p.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.2 * Math.sin(this.time * 8);
      ctx.strokeStyle = "#7ef4ff";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, p.r + 10, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#7ef4ff";
      ctx.beginPath(); ctx.arc(0, 0, p.r + 10, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.rotate(p.angle);
    ctx.fillStyle = "#132019";
    this.rr(ctx, 6, -5, 26, 10, 4); ctx.fill();
    ctx.fillStyle = p.reload > 0 ? "#6f8b7f" : p.explosive > 0 ? COL.rusher : p.color;
    this.rr(ctx, 24, -4, 8, 8, 3); ctx.fill();
    ctx.fillStyle = "#0b1210";
    this.rr(ctx, -15, -14, 30, 28, 11); ctx.fill();
    ctx.fillStyle = "#eaf5ee";
    this.rr(ctx, -13, -12, 26, 24, 9); ctx.fill();
    ctx.fillStyle = p.color;
    this.rr(ctx, -13, -12, 9, 24, 6); ctx.fill();
    ctx.fillStyle = "#0f1c18";
    ctx.beginPath(); ctx.arc(2, 0, 8.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7ef4ff";
    ctx.beginPath(); ctx.ellipse(4.5, 0, 4.6, 6.2, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // étiquette + munitions
    ctx.save();
    ctx.translate(x, y - p.r - 26);
    ctx.font = "800 12px 'Barlow Semi Condensed', Barlow, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5,16,13,0.9)";
    ctx.strokeText(p.name, 0, -8);
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, 0, -8);
    if (showRing && !p.down) {
      for (let i = 0; i < p.mag; i++) {
        ctx.fillStyle = i < p.ammo ? (p.ammo <= 3 ? COL.rusher : p.color) : "rgba(233,245,238,0.16)";
        this.rr(ctx, -p.mag * 2.6 + i * 5.2, 0, 3.6, i < p.ammo ? 7 : 5, 1.4);
        ctx.fill();
      }
      if (p.reload > 0) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 4, 20, -Math.PI / 2, -Math.PI / 2 + (1 - p.reload / 0.95) * TAU); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const q of this.parts) {
      const t = clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = Math.min(1, t * 1.6);
      if (q.kind === 0) {
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.6, q.size * t), 0, TAU); ctx.fill();
      } else if (q.kind === 2) {
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 3 + 6 * t;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.3 - t), 0, TAU); ctx.stroke();
      } else if (q.kind === 3) {
        ctx.font = `800 ${q.size}px Barlow, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(5,16,13,0.85)";
        ctx.strokeText(q.text, q.x, q.y);
        ctx.fillStyle = q.color;
        ctx.fillText(q.text, q.x, q.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawReticle(ctx: CanvasRenderingContext2D) {
    const mx = clamp(this.mouse.x, 0, WORLD.w);
    const my = clamp(this.mouse.y, 0, WORLD.h);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(this.time * 1.1);
    ctx.strokeStyle = COL.player;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath(); ctx.arc(0, 0, 13, 0.18, 1.39); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawScreen(ctx: CanvasRenderingContext2D, s: SimState) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.flashAmt > 0.01) {
      ctx.globalAlpha = this.flashAmt * 0.5;
      ctx.fillStyle = this.flashCol;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalAlpha = 1;
    }
    if (s.phase === "playing" || s.phase === "countdown") {
      this.drawOffscreen(ctx, s);
      this.drawMinimap(ctx, s);
    }
    if (this.isTouch && (s.phase === "playing" || s.phase === "countdown")) this.drawTouch(ctx);
    let by = this.cssH * 0.28;
    for (const b of this.banners) {
      const k = b.t / b.dur;
      const inK = clamp(b.t / 0.16, 0, 1);
      ctx.save();
      ctx.globalAlpha = clamp((1 - k) / 0.25, 0, 1);
      ctx.translate(this.cssW / 2, by);
      ctx.rotate(-0.02);
      ctx.scale(0.7 + 0.3 * inK, 0.7 + 0.3 * inK);
      const size = clamp(this.cssW / 14, 24, 56);
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
      by += 72;
    }
    if (s.phase === "countdown") {
      const n = Math.ceil(s.countdown);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = `${clamp(this.cssW / 6, 60, 140)}px Bungee, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#05100d";
      ctx.strokeText(String(n), this.cssW / 2, this.cssH / 2);
      ctx.fillStyle = COL.boss;
      ctx.fillText(String(n), this.cssW / 2, this.cssH / 2);
      ctx.restore();
    }
    if (this.connection === "reconnecting") {
      ctx.fillStyle = "rgba(5,16,13,0.6)";
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.fillStyle = COL.boss;
      ctx.font = "28px Bungee, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RECONNEXION…", this.cssW / 2, this.cssH / 2);
    }
  }

  private drawTouch(ctx: CanvasRenderingContext2D) {
    const R = this.stickR;
    const stick = (st: { active: boolean; ox: number; oy: number; dx: number; dy: number }, hx: number, hy: number, col: string) => {
      const bx = st.active ? st.ox : hx;
      const by = st.active ? st.oy : hy;
      ctx.save();
      ctx.globalAlpha = st.active ? 0.6 : 0.25;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(st.active ? [] : [7, 8]);
      ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = st.active ? 0.9 : 0.35;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(bx + st.dx * R, by + st.dy * R, R * 0.38, 0, TAU); ctx.fill();
      ctx.restore();
    };
    stick(this.stickMove, 22 + this.safe.l + R, this.cssH - 22 - this.safe.b - R, COL.player);
    stick(this.stickAim, this.cssW - 26 - this.safe.r - R, this.btn.reload.y - this.btn.reload.r - R - 12, COL.grunt);
    if (!this.stickMove.active || !this.stickAim.active) {
      ctx.save();
      ctx.font = "700 10px 'Barlow Semi Condensed', Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.55;
      if (!this.stickMove.active) {
        ctx.fillStyle = COL.player;
        ctx.fillText("BOUGER", 22 + this.safe.l + R, this.cssH - 22 - this.safe.b + 14);
      }
      if (!this.stickAim.active) {
        ctx.fillStyle = COL.grunt;
        ctx.fillText("VISER", this.cssW - 26 - this.safe.r - R, this.btn.reload.y - this.btn.reload.r - 2 * R - 18);
      }
      ctx.restore();
    }
    const b = this.btn;
    const round = (bb: { x: number; y: number; r: number; press: number; id: number }, col: string, label: string) => {
      const rr = bb.r * (1 + bb.press * 0.5);
      ctx.save();
      ctx.globalAlpha = bb.id !== -1 ? 0.9 : 0.55;
      ctx.fillStyle = "#0b1210";
      ctx.beginPath(); ctx.arc(bb.x, bb.y, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bb.x, bb.y, rr, 0, TAU); ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `700 ${Math.round(rr * 0.36)}px "Barlow Semi Condensed", Barlow, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bb.x, bb.y);
      ctx.restore();
    };
    const me = this.me();
    round(b.fire, me?.ammo === 0 ? COL.rusher : COL.chalk, me ? String(me.ammo) : "FEU");
    round(b.dash, COL.boss, "DASH");
    round(b.reload, COL.lime, "CHG");
  }
}
