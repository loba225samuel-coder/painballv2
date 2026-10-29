import { addPlayer, createSim, defaultInput, setInput, startMatch, stepSim } from "../src/game/mpSim";
import { GRAPPE_DMG, GRAPPE_SHOTS, type BonusKind } from "../src/game/rules";

function pick(s: ReturnType<typeof createSim>, id: string, kind: number) {
  const p = s.players.find((x) => x.id === id)!;
  s.pickups.push({ id: s.nextId++, x: p.x, y: p.y, kind: kind as BonusKind, t: 10 });
  stepSim(s, 1 / 60);
  return p;
}

function fresh(mode: "coop" | "versus") {
  const s = createSim(mode, 7);
  addPlayer(s, "a", "Alice");
  addPlayer(s, "b", "Bob");
  startMatch(s);
  // suffisamment d'images pour sortir du compte à rebours (2,2 s)
  for (let i = 0; i < 200; i++) stepSim(s, 1 / 60);
  s.enemies.length = 0;
  s.pending.length = 0;
  s.between = 999;
  s.bullets.length = 0;
  return s;
}

// --- 1. TURBO : vitesse mesurée ------------------------------------------
{
  const s = fresh("coop");
  const a = s.players[0];
  // le coéquipier inactif s'interposait (séparation = mesure divisée par deux)
  s.players[1].x = 40;
  s.players[1].y = 40;
  let seq = 0;
  const run = (frames: number) => {
    const x0 = a.x;
    for (let i = 0; i < frames; i++) {
      setInput(s, a.id, { ...defaultInput(), seq: ++seq, mx: 1, my: 0, aim: 0 });
      stepSim(s, 1 / 60);
    }
    return { dist: a.x - x0, v: a.vx };
  };
  const baseR = run(40);
  const base = baseR.dist;
  pick(s, "a", 7);
  const boostR = run(40);
  const boosted = boostR.dist;
  const ratio = boosted / Math.max(1, base);
  console.log("coop turbo — base:", base.toFixed(0), "(v", baseR.v.toFixed(0) + ")", "boost:", boosted.toFixed(0), "(v", boostR.v.toFixed(0) + ")", "ratio:", ratio.toFixed(2));
  if (ratio < 1.3 || a.turboT <= 0) throw new Error("turbo non appliqué");
}

// --- 2. GRAPPE : 5 billes -------------------------------------------------
{
  const s = fresh("coop");
  const a = pick(s, "a", 8);
  if (a.cluster !== 1) throw new Error("grappe non ramassée");
  a.fireT = 0;
  setInput(s, a.id, { ...defaultInput(), seq: 1, fire: true, aim: 0 });
  stepSim(s, 1 / 60);
  const mine = s.bullets.filter((b) => b.owner === a.id);
  console.log("coop grappe — billes:", mine.length, "| dgts:", mine[0]?.dmg, "| durée:", mine[0]?.life.toFixed(2), "| charges:", a.cluster);
  if (mine.length !== GRAPPE_SHOTS || mine[0]?.dmg !== GRAPPE_DMG || a.cluster !== 0) throw new Error("grappe incorrecte");
}

// --- 3. ENCRE LENTE : impact = ralentissement ennemi ---------------------
{
  const s = fresh("coop");
  const a = pick(s, "a", 9);
  s.enemies.push({
    id: s.nextId++, type: "grunt", x: a.x + 130, y: a.y, vx: 0, vy: 0, r: 15,
    hp: 900, maxHp: 900, angle: 0, speed: 120, fireT: 99, charge: 0, strafe: 1,
    strafeT: 99, lungeT: 0, coolT: 99, flash: 0, volley: 0, stormT: 99, born: 0, slowT: 0,
  });
  a.fireT = 0;
  setInput(s, a.id, { ...defaultInput(), seq: 1, fire: true, aim: 0 });
  for (let i = 0; i < 40; i++) stepSim(s, 1 / 60);
  const e = s.enemies[0];
  console.log("coop encre — slowT:", e?.slowT?.toFixed(2), "| hp:", Math.round(e?.hp ?? 0));
  if (!e || e.slowT <= 0) throw new Error("encre non appliquée");
}

// --- 4. AIMANT : capsule tirée vers le joueur -----------------------------
{
  const s = fresh("coop");
  const a = pick(s, "a", 10);
  s.pickups.push({ id: s.nextId++, x: a.x, y: a.y - 180, kind: 1 as BonusKind, t: 10 });
  const q = s.pickups[s.pickups.length - 1];
  const y0 = q.y;
  for (let i = 0; i < 45; i++) stepSim(s, 1 / 60);
  console.log("coop aimant — capsule: y", Math.round(y0), "=>", Math.round(q.y), "(joueur à", Math.round(a.y) + ")");
  if (!(q.y > y0 + 4)) throw new Error("aimant non appliqué");
}

// --- 5. VERSUS : encre ralentit l'adversaire -----------------------------
{
  const s = fresh("versus");
  const a = pick(s, "a", 9);
  const b = s.players[1];
  b.x = a.x + 150;
  b.y = a.y;
  b.invuln = 0;
  a.fireT = 0;
  setInput(s, a.id, { ...defaultInput(), seq: 1, fire: true, aim: 0 });
  for (let i = 0; i < 40; i++) stepSim(s, 1 / 60);
  console.log("versus encre — adversaire slowT:", b.slowT.toFixed(2), "| hp:", b.hp);
  if (b.slowT <= 0) throw new Error("encre non appliquée en versus");
}

console.log("BONUS 4 — SIM OK");
