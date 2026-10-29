/**
 * Signalisation WebRTC pour les salons privés de PAINTBALL 2D.
 *
 * Une seule fonction, sans base à gérer : Netlify Blobs stocke l'offre du salon,
 * le client vient chercher la réponse. Les salons expirent seuls (5 min).
 *
 *   POST { action: "host", room, sdp }            -> héberge un salon
 *   POST { action: "join", room, sdp }            -> dépose une réponse
 *   POST { action: "poll", room, role }           -> renvoie le SDP attendu
 */
import { getStore } from "@netlify/blobs";

interface Room {
  offer?: string;
  answer?: string;
  at: number;
}

const TTL = 5 * 60 * 1000;

/** Repli mémoire si Blobs n'est pas disponible (dev local, plan sans blob). */
const mem = new Map<string, Room>();

async function getRoom(store: ReturnType<typeof getStore> | null, room: string): Promise<Room> {
  const local = mem.get(room);
  if (local && Date.now() - local.at < TTL) return local;
  if (store) {
    try {
      const r = (await store.getJSON(room)) as Room | null;
      if (r && Date.now() - r.at < TTL) return r;
    } catch {
      /* on retombe sur la mémoire locale */
    }
  }
  return { at: Date.now() };
}

async function putRoom(store: ReturnType<typeof getStore> | null, room: string, value: Room) {
  mem.set(room, value);
  if (store) {
    try {
      await store.setJSON(room, value);
    } catch {
      /* écriture blob refusée : la mémoire tient le salon */
    }
  }
}

const json = (body: unknown, code = 200) =>
  new Response(JSON.stringify(body), {
    status: code,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "POST uniquement" }, 405);

  let payload: { action?: string; room?: string; sdp?: string; role?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "corps JSON invalide" }, 400);
  }

  const room = (payload.room || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const sdp = typeof payload.sdp === "string" ? payload.sdp.slice(0, 200_000) : "";
  if (!room) return json({ error: "code de salon manquant" }, 400);

  let store: ReturnType<typeof getStore> | null = null;
  try {
    store = getStore("paintball-signal");
  } catch {
    store = null;
  }

  const current = await getRoom(store, room);

  switch (payload.action) {
    case "host": {
      await putRoom(store, room, { ...current, offer: sdp, at: Date.now() });
      return json({ ok: true, room });
    }
    case "join": {
      if (!current.offer) return json({ error: "salon introuvable ou expiré" }, 404);
      await putRoom(store, room, { ...current, answer: sdp, at: Date.now() });
      return json({ ok: true, room });
    }
    case "poll": {
      const wanted = payload.role === "host" ? current.answer : current.offer;
      return json({ ok: true, room, sdp: wanted ?? "" });
    }
    default:
      return json({ error: "action inconnue" }, 400);
  }
};

export const config = { path: "/.netlify/functions/signal" };
