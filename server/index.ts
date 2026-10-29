/* Serveur de salons PAINTBALL 2D — autoritaire, sans base de données.
 * Démarrage : npx tsx server/index.ts   (PORT=8787 par défaut) */

import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { addPlayer, createSim, defaultInput, drainEvents, removePlayer, serialize, setInput, startMatch, stepSim } from "../src/game/mpSim";
import type { MpMode, SimState } from "../src/game/mpSim";
import { PROTOCOL_VERSION, roomInfo } from "../src/game/mpProtocol";
import type { ClientMsg, ServerMsg } from "../src/game/mpProtocol";
import { sanitizeName } from "../src/game/rules";

const PORT = Number(process.env.PORT || 8787);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 200);
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 400);
const RECONNECT_MS = 20_000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

interface Client {
  ws: WebSocket;
  id: string;
  code: string | null;
  alive: boolean;
  inputs: number;
  inputWindow: number;
}

interface Room {
  code: string;
  sim: SimState;
  clients: Map<string, Client>;
  created: number;
  acc: number;
  cleanup: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();
const clients = new Set<Client>();

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end("PAINTBALL 2D — serveur de salons. Connectez-vous en WebSocket.\n");
});

const wss = new WebSocketServer({ server: http, maxPayload: 8192 });

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMsg) {
  const data = JSON.stringify(msg);
  for (const c of room.clients.values()) if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
}

function makeCode() {
  for (;;) {
    let code = "";
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (!rooms.has(code)) return code;
  }
}

function snapshot(room: Room) {
  const events = drainEvents(room.sim);
  const ack: Record<string, number> = {};
  for (const p of room.sim.players) ack[p.id] = p.lastSeq;
  broadcast(room, { t: "snapshot", state: serialize(room.sim), events, ack, serverTime: Date.now() });
}

function leaveRoom(c: Client, abandon: boolean) {
  if (!c.code) return;
  const room = rooms.get(c.code);
  c.code = null;
  if (!room) return;
  room.clients.delete(c.id);
  const p = room.sim.players.find((x) => x.id === c.id);
  if (p) {
    if (abandon) {
      removePlayer(room.sim, c.id);
      if (room.sim.players.length < 2 && (room.sim.phase === "playing" || room.sim.phase === "countdown")) {
        room.sim.phase = "ended";
        room.sim.winner = room.sim.players[0]?.id ?? null;
      }
    } else {
      p.connected = false;
      room.sim.inputs[c.id] = defaultInput();
    }
  }
  if (!room.sim.players.length) {
    rooms.delete(room.code);
    if (room.cleanup) clearTimeout(room.cleanup);
    return;
  }
  if (!room.sim.players.some((x) => x.connected) && !room.cleanup) {
    room.cleanup = setTimeout(() => {
      const r = rooms.get(room.code);
      if (r && !r.sim.players.some((x) => x.connected)) rooms.delete(room.code);
    }, RECONNECT_MS);
  }
  broadcast(room, roomInfo(room.sim, room.code));
  snapshot(room);
}

function attach(c: Client, room: Room, id: string, token: string) {
  c.id = id;
  c.code = room.code;
  room.clients.set(id, c);
  if (room.cleanup) {
    clearTimeout(room.cleanup);
    room.cleanup = null;
  }
  const p = room.sim.players.find((x) => x.id === id)!;
  p.connected = true;
  p.lastSeq = 0;
  room.sim.inputs[id] = defaultInput();
  send(c.ws, { t: "welcome", id, token, code: room.code, mode: room.sim.mode, slot: p.slot });
  broadcast(room, roomInfo(room.sim, room.code));
  snapshot(room);
}

function handleMessage(c: Client, msg: ClientMsg) {
  if (msg.t === "ping") return send(c.ws, { t: "pong", time: msg.time });
  if (msg.t === "leave") return leaveRoom(c, true);

  if (msg.t === "create") {
    if (msg.v !== PROTOCOL_VERSION) return send(c.ws, { t: "error", message: "Version du jeu différente : rechargez la page.", fatal: true });
    if (rooms.size >= MAX_ROOMS) return send(c.ws, { t: "error", message: "Serveur plein, réessayez plus tard." });
    leaveRoom(c, true);
    const mode: MpMode = msg.mode === "versus" ? "versus" : "coop";
    const room: Room = { code: makeCode(), sim: createSim(mode), clients: new Map(), created: Date.now(), acc: 0, cleanup: null };
    rooms.set(room.code, room);
    const id = randomUUID();
    const token = randomBytes(16).toString("hex");
    addPlayer(room.sim, id, sanitizeName(msg.name, "JOUEUR 1"), token);
    attach(c, room, id, token);
    return;
  }

  if (msg.t === "join" || msg.t === "rejoin") {
    if (msg.v !== PROTOCOL_VERSION) return send(c.ws, { t: "error", message: "Version du jeu différente : rechargez la page.", fatal: true });
    const code = String(msg.code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return send(c.ws, { t: "error", message: "Salon introuvable ou expiré.", fatal: true });
    if (msg.t === "rejoin") {
      const p = room.sim.players.find((x) => x.id === msg.id && x.token === msg.token);
      if (!p) return send(c.ws, { t: "error", message: "Session expirée, rejoignez avec le code.", fatal: true });
      const old = room.clients.get(p.id);
      if (old && old !== c) {
        old.code = null;
        old.ws.close(4000, "reconnecté ailleurs");
      }
      attach(c, room, p.id, p.token!);
      return;
    }
    if (room.sim.players.length >= 2) return send(c.ws, { t: "error", message: "Ce salon est déjà complet.", fatal: true });
    if (room.sim.phase !== "lobby") return send(c.ws, { t: "error", message: "La partie a déjà commencé.", fatal: true });
    leaveRoom(c, true);
    const id = randomUUID();
    const token = randomBytes(16).toString("hex");
    addPlayer(room.sim, id, sanitizeName(msg.name, "JOUEUR 2"), token);
    attach(c, room, id, token);
    return;
  }

  const room = c.code ? rooms.get(c.code) : null;
  if (!room) return;
  const p = room.sim.players.find((x) => x.id === c.id);
  if (!p) return;

  if (msg.t === "ready") {
    if (room.sim.phase !== "lobby") return;
    p.ready = !!msg.ready;
    broadcast(room, roomInfo(room.sim, room.code));
    snapshot(room);
    return;
  }

  if (msg.t === "start") {
    if (room.sim.hostId !== c.id) return send(c.ws, { t: "error", message: "Seul l'hôte peut lancer la partie." });
    if (room.sim.phase !== "lobby" && room.sim.phase !== "ended") return;
    if (room.sim.players.length < 2 || !room.sim.players.every((x) => x.connected && (x.ready || room.sim.phase === "ended"))) {
      return send(c.ws, { t: "error", message: "Il faut deux joueurs prêts." });
    }
    startMatch(room.sim);
    broadcast(room, roomInfo(room.sim, room.code));
    snapshot(room);
    return;
  }

  if (msg.t === "input") {
    const now = Date.now();
    if (now - c.inputWindow > 1000) {
      c.inputWindow = now;
      c.inputs = 0;
    }
    if (++c.inputs > 180) return;
    if (room.sim.phase !== "playing" && room.sim.phase !== "countdown") return;
    setInput(room.sim, c.id, msg.input);
  }
}

wss.on("connection", (ws, req) => {
  if (clients.size >= MAX_CLIENTS) {
    ws.close(1013, "serveur plein");
    return;
  }
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && origin && origin !== allowed) {
    ws.close(1008, "origine refusée");
    return;
  }
  const c: Client = { ws, id: "", code: null, alive: true, inputs: 0, inputWindow: Date.now() };
  clients.add(c);
  ws.on("pong", () => (c.alive = true));
  ws.on("message", (data, isBinary) => {
    if (isBinary) return;
    try {
      const msg = JSON.parse(data.toString()) as ClientMsg;
      if (!msg || typeof msg.t !== "string") return;
      handleMessage(c, msg);
    } catch {
      send(ws, { t: "error", message: "Message invalide." });
    }
  });
  ws.on("close", () => {
    clients.delete(c);
    leaveRoom(c, false);
  });
  ws.on("error", () => {
    clients.delete(c);
    leaveRoom(c, false);
  });
});

// Simulation 60 Hz, snapshots 20 Hz (5 Hz dans les salons).
let last = Date.now();
let acc = 0;
const DT = 1 / 60;
setInterval(() => {
  const now = Date.now();
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= DT) {
    acc -= DT;
    for (const room of rooms.values()) {
      const active = room.sim.players.some((p) => p.connected);
      if (active && (room.sim.phase === "playing" || room.sim.phase === "countdown")) stepSim(room.sim, DT);
      room.acc++;
      const every = room.sim.phase === "lobby" || room.sim.phase === "ended" ? 12 : 3;
      if (room.acc >= every) {
        room.acc = 0;
        snapshot(room);
      }
    }
  }
}, 1000 / 60);

// Heartbeat : coupe les sockets fantômes.
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) {
      c.ws.terminate();
      continue;
    }
    c.alive = false;
    c.ws.ping();
  }
  // salons vides ou abandonnés depuis trop longtemps
  for (const room of rooms.values()) {
    const idle = Date.now() - room.created > 30 * 60 * 1000;
    const empty = !room.sim.players.some((p) => p.connected);
    if (idle || (empty && !room.cleanup)) rooms.delete(room.code);
  }
}, 15_000);

http.listen(PORT, () => {
  console.log(`🎨 PAINTBALL 2D — salons WebSocket sur le port ${PORT}`);
});

function shutdown() {
  for (const c of clients) c.ws.close(1001, "redémarrage serveur");
  wss.close();
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
