/**
 * Progression en ligne — Supabase.
 *
 * Deux niveaux, volontairement :
 *  - LECTURE : ouverte (classement mondial), sans compte, sans écriture.
 *  - ÉCRITURE (partie terminée, sauvegarde, nom) : compte anonyme, créé
 *    SEULEMENT à ce moment-là. Une simple visite ne remplit donc plus la base.
 *
 * Le jeu reste jouable hors ligne : tout a un repli localStorage.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SaveState } from "@/game/engine";

export const SUPABASE_URL = "https://ipdohwwyletjrkdrlyma.supabase.co";
/** Clé publiable (ex-clé anon) : conçue pour être exposée, la sécurité est la RLS. */
export const SUPABASE_KEY = "sb_publishable_LgjP7-DwqNAIguffgWO5Fw_DkCeRS9r";

export type LinkState = "checking" | "cloud" | "local";

export interface Progress {
  name: string;
  bestScore: number;
  bestWave: number;
  totalRuns: number;
  totalKills: number;
  totalPaint: number;
  totalSeconds: number;
}

export interface WorldRow {
  name: string;
  score: number;
  wave: number;
  kills: number;
  coverage: number;
  duo: boolean;
  created_at: string;
}

export interface RunInput {
  name: string;
  score: number;
  wave: number;
  kills: number;
  kills2: number;
  accuracy: number;
  coverage: number;
  duration: number;
  duo: boolean;
}

const LOCAL_SAVE_KEY = "pb2d.save.v1";

export interface StoredSave {
  label: string;
  wave: number;
  score: number;
  at: number;
  payload: SaveState;
}

let client: SupabaseClient | null = null;
let probe: Promise<LinkState> | null = null;
let auth: Promise<string | null> | null = null;
let state: LinkState = "checking";

export const linkState = () => state;

function db(): SupabaseClient | null {
  if (client) return client;
  if (typeof fetch === "undefined") return null;
  try {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "pb2d.auth" },
    });
    return client;
  } catch {
    client = null;
    return null;
  }
}

/**
 * Vérifie que la base répond — SANS créer de compte.
 * Le classement est lisible par tout le monde (RLS select = true).
 */
export function connect(): Promise<LinkState> {
  if (probe) return probe;
  probe = (async () => {
    const sb = db();
    if (!sb) {
      state = "local";
      return state;
    }
    try {
      const { error } = await sb.from("leaderboard").select("name", { count: "exact", head: true });
      state = error ? "local" : "cloud";
    } catch {
      state = "local";
    }
    return state;
  })();
  return probe;
}

/** Compte anonyme, créé à la première ÉCRITURE seulement. Retourne l'identifiant. */
function ensureAuth(): Promise<string | null> {
  if (auth) return auth;
  auth = (async () => {
    const sb = db();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      let uid = data.session?.user?.id ?? null;
      if (!uid) {
        const res = await sb.auth.signInAnonymously();
        if (res.error) return null;
        uid = res.data.user?.id ?? null;
      }
      if (!uid) return null;
      await sb.from("profiles").upsert({ id: uid, last_seen: new Date().toISOString() });
      state = "cloud";
      return uid;
    } catch {
      return null;
    }
  })();
  return auth;
}

/** Identifiant du compte DÉJÀ présent : n'en crée jamais un. */
async function currentUserId(): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ---------------- progression ---------------- */

/** Dépose une partie et met à jour la progression. Faux si hors ligne. */
export async function submitRun(run: RunInput): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const uid = await ensureAuth();
  if (!uid) {
    state = "local";
    return false;
  }
  try {
    const { error } = await sb.rpc("submit_run", {
      p_name: run.name,
      p_score: run.score,
      p_wave: run.wave,
      p_kills: run.kills,
      p_coverage: run.coverage,
      p_duration: run.duration,
      p_duo: run.duo,
      p_kills2: run.kills2,
      p_accuracy: run.accuracy,
    });
    if (!error) return true;
    // la RPC n'existe pas encore (schéma non appliqué) : insert simple
    const { error: insErr } = await sb.from("runs").insert({
      player_id: uid,
      name: run.name,
      score: run.score,
      wave: run.wave,
      kills: run.kills,
      kills2: run.kills2,
      accuracy: run.accuracy,
      coverage: run.coverage,
      duration: run.duration,
      duo: run.duo,
    });
    return !insErr;
  } catch {
    return false;
  }
}

export async function fetchWorld(limit = 20): Promise<WorldRow[] | null> {
  const sb = db();
  if (!sb || state !== "cloud") return null;
  try {
    const { data, error } = await sb
      .from("leaderboard")
      .select("name,score,wave,kills,coverage,duo,created_at")
      .limit(limit);
    if (error) return null;
    return (data ?? []) as WorldRow[];
  } catch {
    return null;
  }
}

export async function fetchProgress(): Promise<Progress | null> {
  const sb = db();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  try {
    const { data } = await sb
      .from("profiles")
      .select("name,best_score,best_wave,total_runs,total_kills,total_paint,total_seconds")
      .eq("id", uid)
      .maybeSingle();
    const row = data as unknown as {
      name: string;
      best_score: number;
      best_wave: number;
      total_runs: number;
      total_kills: number;
      total_paint: number;
      total_seconds: number;
    } | null;
    if (!row) return null;
    return {
      name: row.name ?? "ACE",
      bestScore: row.best_score ?? 0,
      bestWave: row.best_wave ?? 0,
      totalRuns: row.total_runs ?? 0,
      totalKills: row.total_kills ?? 0,
      totalPaint: Number(row.total_paint ?? 0),
      totalSeconds: row.total_seconds ?? 0,
    };
  } catch {
    return null;
  }
}

export async function setName(name: string): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const uid = await ensureAuth();
  if (!uid) return false;
  try {
    const { error } = await sb.from("profiles").update({ name: name.slice(0, 12) }).eq("id", uid);
    return !error;
  } catch {
    return false;
  }
}

/* ---------------- sauvegarde de partie (reprendre plus tard) ---------------- */

/** Sauvegarde locale : immédiate, fonctionne hors ligne. */
export function saveLocal(save: SaveState) {
  try {
    localStorage.setItem(
      LOCAL_SAVE_KEY,
      JSON.stringify({ label: save.label, wave: save.wave, score: save.score, at: save.at, payload: save })
    );
    return true;
  } catch {
    return false; // stockage plein ou désactivé
  }
}

export function loadLocal(): StoredSave | null {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSave;
    return parsed && parsed.payload ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(LOCAL_SAVE_KEY);
  } catch {
    /* rien à nettoyer */
  }
}

export async function pushSave(save: SaveState): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const uid = await ensureAuth();
  if (!uid) return false;
  try {
    const { error } = await sb.from("saves").upsert(
      {
        player_id: uid,
        label: save.label,
        wave: save.wave,
        score: save.score,
        payload: save,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function pullSave(): Promise<StoredSave | null> {
  const sb = db();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  try {
    const { data } = await sb
      .from("saves")
      .select("label,wave,score,updated_at,payload")
      .eq("player_id", uid)
      .maybeSingle();
    const row = data as unknown as {
      label: string;
      wave: number;
      score: number;
      updated_at: string;
      payload: SaveState;
    } | null;
    if (!row || !row.payload) return null;
    return {
      label: row.label || "PARTIE SAUVEGARDÉE",
      wave: row.wave ?? 0,
      score: row.score ?? 0,
      at: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      payload: row.payload,
    };
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const uid = await ensureAuth();
  if (!uid) return false;
  try {
    const { error } = await sb.from("saves").delete().eq("player_id", uid);
    return !error;
  } catch {
    return false;
  }
}
