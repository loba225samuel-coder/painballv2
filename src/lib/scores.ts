export interface ScoreRow {
  name: string;
  score: number;
  wave: number;
  kills: number;
  coverage: number;
  date: number;
}

const KEY = "pb2d.scores.v1";

/** Même longueur que le pseudo cloud Supabase (profiles.display_name). */
export const MAX_NAME_LENGTH = 16;

export function cleanName(raw: unknown, fallback = "JOUEUR"): string {
  const s = String(raw ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return s || fallback;
}

const clamp01 = (v: unknown) => Math.max(0, Math.min(1, Number(v) || 0));

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.score === "number")
      .map((r) => ({
        name: cleanName(r.name, "JOUEUR"),
        score: Math.floor(r.score),
        wave: Math.floor(r.wave ?? 0),
        kills: Math.floor(r.kills ?? 0),
        coverage: clamp01(r.coverage),
        date: Number(r.date ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function saveScore(row: ScoreRow): { rows: ScoreRow[]; rank: number } {
  const entry: ScoreRow = {
    ...row,
    name: cleanName(row.name),
    score: Math.max(0, Math.floor(row.score)),
    wave: Math.max(0, Math.floor(row.wave)),
    kills: Math.max(0, Math.floor(row.kills)),
    coverage: clamp01(row.coverage),
    date: row.date || Date.now(),
  };
  const rows = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* storage may be unavailable */
  }
  const rank = rows.findIndex((r) => r.date === entry.date && r.score === entry.score && r.name === entry.name) + 1;
  return { rows, rank };
}

export function bestScore(rows: ScoreRow[]) {
  return rows.length ? rows[0].score : 0;
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
