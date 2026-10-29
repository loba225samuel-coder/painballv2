/* ------------------------------------------------------------------ *
 * NETCODE — salons privés WebRTC (co-op en ligne)
 *
 * Choix assumés, pour ne pas faire d'usine à gaz :
 *  - hôte autoritaire : l'hôte simule tout, le client envoie ses entrées
 *  - le client applique des snapshots (positions, PV, score) à ~20 Hz
 *  - pas de rollback : le versus 1v1 l'exigera, la co-op non
 *  - signalisation via une Netlify Function, avec repli « manuel »
 *    (échange de SDP copié-collé) si la fonction n'est pas déployée
 * ------------------------------------------------------------------ */

export type NetStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "joining"
  | "connecting"
  | "live"
  | "manual"
  | "error";

export interface RemoteInput {
  mx: number;
  my: number;
  aim: number;
  fire: boolean;
  dash: boolean;
  reload: boolean;
}

export interface SnapshotPilot {
  x: number;
  y: number;
  a: number;
  hp: number;
  ammo: number;
  dead: boolean;
}

export interface SnapshotEnemy {
  x: number;
  y: number;
  a: number;
  hp: number;
  kind: number;
}

export interface Snapshot {
  t: number;
  wave: number;
  score: number;
  kills: number;
  pilots: SnapshotPilot[];
  enemies: SnapshotEnemy[];
}

export type NetEvent =
  | { type: "status"; status: NetStatus; detail: string }
  | { type: "state"; state: Snapshot }
  | { type: "input"; input: RemoteInput }
  | { type: "connected" }
  | { type: "closed"; reason: string };

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas de O/0/I/1

export function makeRoomCode(len = 4) {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

const SIGNAL_URL = "/.netlify/functions/signal";

/** Échange d'offres/réponses : Netlify Function d'abord, sinon mode manuel. */
async function signal(body: Record<string, unknown>, timeoutMs = 6000): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(SIGNAL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class NetRoom {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private poll = 0;
  private closed = false;
  private startedAt = 0;
  /** SDP local à copier si la signalisation automatique échoue */
  localSdp = "";
  /** SDP distant à coller en mode manuel */
  remoteSdp = "";

  constructor(private emit: (e: NetEvent) => void) {}

  private status(status: NetStatus, detail = "") {
    this.emit({ type: "status", status, detail });
  }

  private newPeer() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed" || s === "disconnected") {
        if (!this.closed) this.emit({ type: "closed", reason: "connexion perdue" });
      }
    };
    pc.ondatachannel = (ev) => this.wire(ev.channel);
    this.pc = pc;
    return pc;
  }

  private wire(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      this.closed = false;
      this.status("live", "connecté");
      this.emit({ type: "connected" });
    };
    dc.onclose = () => {
      if (!this.closed) this.emit({ type: "closed", reason: "canal fermé" });
    };
    dc.onerror = () => this.status("error", "erreur sur le canal de jeu");
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        if (msg.k === "i") this.emit({ type: "input", input: msg.i as RemoteInput });
        else if (msg.k === "s") this.emit({ type: "state", state: msg.s as Snapshot });
        else if (msg.k === "bye") this.emit({ type: "closed", reason: "l'autre joueur a quitté" });
      } catch {
        /* paquet illisible : on ignore */
      }
    };
    this.dc = dc;
  }

  private send(payload: Record<string, unknown>) {
    if (this.dc && this.dc.readyState === "open") {
      try {
        this.dc.send(JSON.stringify(payload));
      } catch {
        /* canal en train de fermer */
      }
    }
  }

  sendInput(i: RemoteInput) {
    this.send({ k: "i", i });
  }
  sendState(s: Snapshot) {
    this.send({ k: "s", s });
  }
  sendStart() {
    this.send({ k: "go" });
  }
  get live() {
    return !!this.dc && this.dc.readyState === "open";
  }

  /** Crée un salon : retourne le code à partager. */
  async host(code: string) {
    if (typeof RTCPeerConnection === "undefined") {
      this.status("error", "WebRTC indisponible sur ce navigateur");
      return;
    }
    this.closed = false;
    this.startedAt = Date.now();
    this.status("creating", "création du salon…");
    const pc = this.newPeer();
    const dc = pc.createDataChannel("paint", { ordered: true });
    this.wire(dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.localSdp = JSON.stringify(pc.localDescription);
    const res = await signal({ action: "host", room: code, sdp: this.localSdp });
    if (!res) {
      this.status("manual", "signalisation indisponible — échange manuel requis");
      return;
    }
    this.status("waiting", "en attente du 2e joueur…");
    this.pollFor(code, "host");
  }

  /** Rejoint un salon par son code. */
  async join(code: string) {
    if (typeof RTCPeerConnection === "undefined") {
      this.status("error", "WebRTC indisponible sur ce navigateur");
      return;
    }
    this.closed = false;
    this.startedAt = Date.now();
    this.status("joining", "recherche du salon…");
    const res = await signal({ action: "poll", room: code, role: "guest" });
    const offer = res && typeof res.sdp === "string" ? res.sdp : "";
    if (!offer) {
      this.status(res ? "error" : "manual", res ? "salon introuvable ou expiré" : "signalisation indisponible — échange manuel");
      return;
    }
    await this.acceptOffer(code, offer);
  }

  private async acceptOffer(code: string, offerSdp: string) {
    const pc = this.newPeer();
    await pc.setRemoteDescription(JSON.parse(offerSdp) as RTCSessionDescriptionInit);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.localSdp = JSON.stringify(pc.localDescription);
    const res = await signal({ action: "join", room: code, sdp: this.localSdp });
    if (!res) {
      this.status("manual", "signalisation indisponible — échange manuel requis");
      return;
    }
    this.status("connecting", "connexion en cours…");
    this.pollFor(code, "guest");
  }

  /** Mode manuel : l'hôte colle la réponse obtenue par un autre canal. */
  async acceptAnswer(answerSdp: string) {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(JSON.parse(answerSdp) as RTCSessionDescriptionInit);
      this.status("connecting", "connexion en cours…");
    } catch {
      this.status("error", "réponse invalide");
    }
  }

  /** Mode manuel côté client : l'offre collée démarre la négociation. */
  async manualJoin(offerSdp: string) {
    try {
      await this.acceptOffer("manual", offerSdp);
      this.status("manual", "colle la réponse chez l'hôte, puis la connexion s'établit");
    } catch {
      this.status("error", "offre invalide");
    }
  }

  private pollFor(code: string, role: "host" | "guest") {
    clearInterval(this.poll);
    const tick = async () => {
      if (this.closed) return;
      const res = await signal({ action: "poll", room: code, role });
      const sdp = res && typeof res.sdp === "string" ? res.sdp : "";
      if (sdp) {
        clearInterval(this.poll);
        if (role === "host") await this.acceptAnswer(sdp);
        else await this.acceptOffer(code, sdp);
        return;
      }
      if (Date.now() - this.startedAt > 120000) {
        clearInterval(this.poll);
        this.status("error", "personne n'a rejoint le salon (2 min)");
      }
    };
    this.poll = window.setInterval(() => void tick(), 900);
    void tick();
  }

  close(reason = "quitté") {
    this.closed = true;
    clearInterval(this.poll);
    try {
      this.send({ k: "bye" });
      this.dc?.close();
      this.pc?.close();
    } catch {
      /* déjà fermé */
    }
    this.dc = null;
    this.pc = null;
    this.status("idle", reason);
    this.emit({ type: "closed", reason });
  }
}
