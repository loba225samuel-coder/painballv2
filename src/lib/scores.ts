export interface ScoreRow {
  name: string;
  score: number;
  wave: number;
  kills: number;
  coverage: number;
  date: number;
}

const KEY = "pb2d.scores.v1";

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.score === "number")
      .map((r) => ({
        name: String(r.name ?? "AAA").slice(0, 3).toUpperCase(),
        score: Math.floor(r.score),
        wave: Math.floor(r.wave ?? 0),
        kills: Math.floor(r.kills ?? 0),
        coverage: Math.floor(r.coverage ?? 0),
        date: Number(r.date ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function saveScore(row: ScoreRow): { rows: ScoreRow[]; rank: number } {
  const rows = [...loadScores(), row].sort((a, b) => b.score - a.score).slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* storage may be unavailable */
  }
  const rank = rows.findIndex((r) => r === row) + 1;
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
