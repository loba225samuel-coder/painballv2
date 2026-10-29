import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { cleanName } from "@/lib/scores";
import type { SavedRun } from "@/game/engine";

export type GameMode = "solo" | "coop" | "versus";
export type CloudStatus = "loading" | "local" | "guest" | "account" | "error";

export interface PlayerSettings {
  muted?: boolean;
  vibe?: boolean;
  name?: string;
}

export interface PlayerProgress {
  rotateSeen?: boolean;
  tutorialSeen?: boolean;
  lastMode?: GameMode;
}

export interface Profile {
  id: string;
  display_name: string;
  paint_color: string;
  settings: PlayerSettings;
  progress: PlayerProgress;
  created_at: string;
  updated_at: string;
}

export interface PlayerStats {
  user_id: string;
  games_played: number;
  total_score: number;
  best_score: number;
  best_wave: number;
  total_kills: number;
  total_shots: number;
  total_hits: number;
  best_coverage: number;
  total_time: number;
  coop_games: number;
  versus_games: number;
  versus_wins: number;
  updated_at: string;
}

export interface RunRow {
  id: string;
  mode: GameMode;
  score: number;
  wave: number;
  kills: number;
  shots: number;
  hits: number;
  max_combo: number;
  coverage: number;
  duration: number;
  won: boolean | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface LeaderRow {
  display_name: string;
  paint_color: string;
  score: number;
  wave: number;
  coverage: number;
  grade: string;
  created_at: string;
}

export interface SavedRunMeta {
  mode: GameMode;
  wave: number;
  score: number;
  savedAt: number;
  label: string;
}

export interface RunInput {
  mode: GameMode;
  score: number;
  wave: number;
  kills: number;
  shots: number;
  hits: number;
  max_combo: number;
  coverage: number;
  duration: number;
  won?: boolean | null;
  details?: Record<string, unknown>;
}

export function gradeFor(totalScore: number, bestWave: number) {
  if (bestWave >= 20 || totalScore >= 500000) return "LÉGENDE";
  if (bestWave >= 10 || totalScore >= 150000) return "VÉTÉRAN";
  if (bestWave >= 5 || totalScore >= 40000) return "SPRAYEUR";
  return "RECRUE";
}

const SAVE_KEY = "pb2d.save.solo";

const localPlayerName = () => cleanName(localStorage.getItem("pb.name") || "JOUEUR");
const isDefaultName = (n?: string | null) => !n || /^JOUEUR(-[0-9A-Fa-f]{4})?$/i.test(n);

function readLocalSave(): SavedRun | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRun;
    if (!parsed || parsed.v !== 1 || parsed.mode !== "solo") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalSave(save: SavedRun) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // quota dépassé : on garde au moins la progression, sans le calque de peinture
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, paint: "" }));
    } catch {
      /* stockage indisponible */
    }
  }
}

function metaOf(save: SavedRun): SavedRunMeta {
  return { mode: save.mode, wave: save.wave, score: save.score, savedAt: save.savedAt, label: save.label };
}

function friendlyAuthError(message: string) {
  if (/anonymous/i.test(message) && /disabled|not enabled/i.test(message)) {
    return "Connexion invité désactivée : activez Anonymous Sign-Ins dans Supabase → Authentication → Providers.";
  }
  if (/rate limit/i.test(message)) return "Trop de tentatives, réessayez dans une minute.";
  return message;
}

function friendlyDbError(message: string) {
  if (/relation .* does not exist|schema cache|Could not find the function/i.test(message)) {
    return "Base non initialisée : exécutez supabase/migrations/202610280001_progression.sql dans le SQL Editor Supabase.";
  }
  return message;
}

export function useProgression() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [leaders, setLeaders] = useState<Partial<Record<GameMode, LeaderRow[]>>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [saveMeta, setSaveMeta] = useState<SavedRunMeta | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const pendingRun = useRef<RunInput | null>(null);

  const userId = session?.user.id ?? null;
  const isAnonymous = !!session?.user.is_anonymous;
  const status: CloudStatus = !ready
    ? "loading"
    : session
      ? isAnonymous
        ? "guest"
        : "account"
      : error
        ? "error"
        : "local";

  /* ---------- session ---------- */
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
      if (!next) {
        setProfile(null);
        setStats(null);
        setRuns([]);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadLeaderboard = useCallback(async (mode: GameMode) => {
    const { data, error: e } = await supabase.rpc("leaderboard", { p_mode: mode, p_limit: 10 });
    if (e) {
      setError(friendlyDbError(e.message));
      return;
    }
    setLeaders((prev) => ({ ...prev, [mode]: (data ?? []) as LeaderRow[] }));
  }, []);

  /** Écrit le pseudo sans jamais dépendre d'une ligne profil déjà présente. */
  const pushName = useCallback(
    async (raw: string) => {
      const clean = cleanName(raw, "");
      // champ vidé : on garde le nom connu plutôt que de basculer sur « JOUEUR »
      if (!clean) return profile?.display_name || localPlayerName();
      localStorage.setItem("pb.name", clean);
      if (!userId) return clean;
      setProfile((p) => (p ? { ...p, display_name: clean, settings: { ...p.settings, name: clean } } : p));

      // Fonction SQL dédiée (migration 0003). Si elle n'est pas encore installée,
      // on retombe sur un upsert RLS classique.
      const rpc = await supabase.rpc("set_profile_name", { p_name: clean });
      if (!rpc.error && rpc.data) {
        setProfile(rpc.data as Profile);
        setLastSync(Date.now());
        return clean;
      }

      const up = await supabase
        .from("profiles")
        .upsert({ id: userId, display_name: clean }, { onConflict: "id" })
        .select("*")
        .single();
      if (up.error) setError(friendlyDbError(up.error.message));
      else {
        setProfile(up.data as Profile);
        setLastSync(Date.now());
      }
      return clean;
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    const [p, s, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("player_stats").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
    ]);
    if (p.error) setError(friendlyDbError(p.error.message));
    else if (p.data) {
      const prof = p.data as Profile;
      setProfile(prof);
      // répare un pseudo technique si le joueur a déjà choisi un nom localement
      const local = localPlayerName();
      if (isDefaultName(prof.display_name) && !isDefaultName(local)) void pushName(local);
    } else {
      // filet de sécurité si le déclencheur n'a pas encore créé le profil :
      // on crée avec le nom local, sans écraser un profil existant.
      await pushName(localPlayerName());
    }
    if (s.error) setError(friendlyDbError(s.error.message));
    else setStats((s.data as PlayerStats) ?? null);
    if (!r.error) setRuns((r.data ?? []) as RunRow[]);
    setBusy(false);
    setLastSync(Date.now());
    void loadLeaderboard("solo");
  }, [userId, loadLeaderboard, pushName]);

  const doRecord = useCallback(
    async (input: RunInput) => {
      if (!userId) return false;
      setSaving(true);
      const { error: e } = await supabase.rpc("record_run", {
        p_mode: input.mode,
        p_score: Math.round(input.score),
        p_wave: Math.round(input.wave),
        p_kills: Math.round(input.kills),
        p_shots: Math.round(input.shots),
        p_hits: Math.round(input.hits),
        p_max_combo: Math.round(input.max_combo),
        p_coverage: input.coverage,
        p_duration: input.duration,
        p_won: input.won ?? null,
        p_details: input.details ?? {},
      });
      setSaving(false);
      if (e) {
        setError(friendlyDbError(e.message));
        return false;
      }
      setError(null);
      await refresh();
      return true;
    },
    [userId, refresh]
  );

  useEffect(() => {
    if (!userId) return;
    void refresh().then(() => {
      const pending = pendingRun.current;
      if (pending) {
        pendingRun.current = null;
        void doRecord(pending);
      }
    });
  }, [userId, refresh, doRecord]);

  /* ---------- auth ---------- */
  const enableGuest = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: localPlayerName() } },
    });
    setBusy(false);
    if (e) setError(friendlyAuthError(e.message));
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Adresse email invalide.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: localPlayerName() },
      },
    });
    setBusy(false);
    if (e) setError(friendlyAuthError(e.message));
    else setMagicSent(true);
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setProfile(null);
    setStats(null);
    setRuns([]);
    setMagicSent(false);
  }, []);

  /* ---------- sauvegardes ---------- */
  const recordRun = useCallback(
    async (input: RunInput) => {
      if (!userId) {
        pendingRun.current = input;
        return false;
      }
      return doRecord(input);
    },
    [userId, doRecord]
  );

  const saveSettings = useCallback(
    async (patch: PlayerSettings) => {
      if (!userId) return;
      const next = { ...(profile?.settings ?? {}), ...patch };
      setProfile((p) => (p ? { ...p, settings: next } : p));
      const { error: e } = await supabase.from("profiles").update({ settings: next }).eq("id", userId);
      if (e) setError(friendlyDbError(e.message));
      else setLastSync(Date.now());
    },
    [userId, profile?.settings]
  );

  const saveProgress = useCallback(
    async (patch: PlayerProgress) => {
      if (!userId) return;
      const next = { ...(profile?.progress ?? {}), ...patch };
      setProfile((p) => (p ? { ...p, progress: next } : p));
      const { error: e } = await supabase.from("profiles").update({ progress: next }).eq("id", userId);
      if (e) setError(friendlyDbError(e.message));
    },
    [userId, profile?.progress]
  );

  const rename = useCallback(
    async (name: string) => {
      await pushName(name);
    },
    [pushName]
  );

  const setColor = useCallback(
    async (color: string) => {
      if (!userId) return;
      setProfile((p) => (p ? { ...p, paint_color: color } : p));
      const { error: e } = await supabase.from("profiles").update({ paint_color: color }).eq("id", userId);
      if (e) setError(friendlyDbError(e.message));
    },
    [userId]
  );

  /* ---------- sauvegarde de partie en cours ---------- */

  const refreshSave = useCallback(async () => {
    const local = readLocalSave();
    let cloud: SavedRun | null = null;
    if (userId) {
      const { data, error: e } = await supabase
        .from("saved_runs")
        .select("*")
        .eq("user_id", userId)
        .eq("mode", "solo")
        .maybeSingle();
      if (e) setError(friendlyDbError(e.message));
      else if (data) {
        const row = data as { state: Omit<SavedRun, "paint">; paint: string | null; saved_at: string };
        cloud = { ...(row.state as SavedRun), paint: row.paint ?? "" };
        if (!cloud.savedAt) cloud.savedAt = new Date(row.saved_at).getTime();
      }
    }
    const chosen = !cloud ? local : !local ? cloud : local.savedAt >= cloud.savedAt ? local : cloud;
    setSaveMeta(chosen ? metaOf(chosen) : null);
    // si la sauvegarde locale est plus récente, on la remonte dans le cloud
    if (userId && local && (!cloud || local.savedAt > cloud.savedAt)) {
      const { paint, ...state } = local;
      await supabase.from("saved_runs").upsert({
        user_id: userId,
        mode: "solo",
        state,
        paint,
        wave: local.wave,
        score: Math.round(local.score),
        label: local.label.slice(0, 80),
        saved_at: new Date(local.savedAt).toISOString(),
      });
    }
  }, [userId]);

  useEffect(() => {
    void refreshSave();
  }, [refreshSave]);

  const saveGame = useCallback(
    async (save: SavedRun): Promise<"cloud" | "local" | null> => {
      if (!save || save.v !== 1) return null;
      setSaveBusy(true);
      writeLocalSave(save);
      setSaveMeta(metaOf(save));
      let result: "cloud" | "local" = "local";
      if (userId) {
        const { paint, ...state } = save;
        const { error: e } = await supabase.from("saved_runs").upsert({
          user_id: userId,
          mode: "solo",
          state,
          paint,
          wave: save.wave,
          score: Math.round(save.score),
          label: save.label.slice(0, 80),
          saved_at: new Date(save.savedAt).toISOString(),
        });
        if (e) setError(friendlyDbError(e.message));
        else {
          result = "cloud";
          setLastSync(Date.now());
        }
      }
      setSaveBusy(false);
      return result;
    },
    [userId]
  );

  const loadSavedGame = useCallback(async (): Promise<SavedRun | null> => {
    const local = readLocalSave();
    if (!userId) return local;
    const { data, error: e } = await supabase
      .from("saved_runs")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", "solo")
      .maybeSingle();
    if (e || !data) return local;
    const row = data as { state: Omit<SavedRun, "paint">; paint: string | null; saved_at: string };
    const cloud = { ...(row.state as SavedRun), paint: row.paint ?? "" };
    if (!cloud.savedAt) cloud.savedAt = new Date(row.saved_at).getTime();
    if (!local) return cloud;
    return local.savedAt >= cloud.savedAt ? local : cloud;
  }, [userId]);

  const deleteGame = useCallback(async () => {
    localStorage.removeItem(SAVE_KEY);
    setSaveMeta(null);
    if (userId) {
      const { error: e } = await supabase.from("saved_runs").delete().eq("user_id", userId).eq("mode", "solo");
      if (e) setError(friendlyDbError(e.message));
    }
  }, [userId]);

  const localName = localPlayerName();
  const displayName =
    profile && !isDefaultName(profile.display_name)
      ? profile.display_name
      : !isDefaultName(localName)
        ? localName
        : "JOUEUR";

  return {
    status,
    session,
    profile,
    displayName,
    stats,
    runs,
    leaders,
    busy,
    saving,
    error,
    magicSent,
    lastSync,
    saveMeta,
    saveBusy,
    grade: gradeFor(stats?.total_score ?? 0, stats?.best_wave ?? 0),
    cloudBest: stats?.best_score ?? 0,
    enableGuest,
    sendMagicLink,
    signOut,
    recordRun,
    saveSettings,
    saveProgress,
    rename,
    setColor,
    refresh,
    loadLeaderboard,
    saveGame,
    loadSavedGame,
    deleteGame,
    refreshSave,
    clearError: () => setError(null),
  };
}

export type ProgressionApi = ReturnType<typeof useProgression>;
