# Propositions de bonus ramassables

> Document de conception — **aucune de ces idées n'est implémentée**.
> Chaque ligne indique le crochet technique existant dans `src/game/engine.ts`,
> pour juger le rapport fun / coût avant de coder.

## Ce qui existe déjà

| Bonus | Effet | Durée |
| --- | --- | --- |
| **OVERCLOCK** | cadence 0,108 s → 0,062 s | 5 s |
| **TRIPLE STREAM** | 3 jets par tir | 9 s |
| **+PAINT** | +2 peintures de vie | immédiat |

Taux de drop actuel : 24 % à la mort d'un ennemi, 100 % pour un boss.
Poche de tirage : `[ammo, med, power, ammo, power]`.

---

## A. Attaque

| # | Bonus | Effet | Durée | Crochet existant | Coût |
| --- | --- | --- | --- | --- | --- |
| 1 | **PEINTURE PERÇANTE** | les billes traversent les ennemis (2 traversées) | 8 s | compteur `pierce` sur la bille, on saute le `gone = true` | **très faible** |
| 2 | **REBOND** | les billes rebondissent 2 fois sur les bunkers et les murs | 10 s | `collideRect` / `hitsRect` → inversion de `vx, vy` | faible |
| 3 | **TIR GUIDÉ** | les billes s'orientent vers l'ennemi le plus proche | 6 s | `updateBullets` : `lerp` de l'angle vers `nearestPilot` | faible |
| 4 | **BOMBE À PEINTURE** | énorme éclat infligeant des dégâts en zone | instantané | `ring` + `splat` + boucle de dégâts autour du point | moyen |
| 5 | **PLUIE DE PEINTURE** | 12 obus tombent sur les ennemis en 3 s | 3 s | `telegraphs` + dégâts différés (déjà utilisé par le boss) | moyen |
| 6 | **MÉGA BILLE** | un tir lent, énorme, qui explose en cône | instantané | bille à `r: 22`, `dmg` en AoE à l'impact | moyen |

## B. Défense / mobilité

| # | Bonus | Effet | Durée | Crochet existant | Coût |
| --- | --- | --- | --- | --- | --- |
| 7 | **BOUCLIER** | absorbe les 2 prochains éclats (anneau visible) | jusqu'à 2 coups | compteur `shield` sur le pilote, anneau dans `drawPlayer` | **très faible** |
| 8 | **TURBO DASH** | recharge de dash à zéro, dash à volonté | 6 s | `p.dashCd = 0` + garde `dashT` | **très faible** |
| 9 | **FANTÔME** | i-frames totales, traversée des ennemis, sans tir possible | 4 s | `invuln` + passage en `ghost` (déjà un `ghost` dans le code) | faible |
| 10 | **LEURRE** | un appât attire les tirs pendant 6 s | 6 s | cible alternative dans `updateEnemies` (`target`) | moyen |

## C. Score / économie

| # | Bonus | Effet | Durée | Crochet existant | Coût |
| --- | --- | --- | --- | --- | --- |
| 11 | **DOUBLE SCORE** | tous les points ×2 | 10 s | facteur dans `killEnemy` + `wave` bonus | **très faible** |
| 12 | **AIMANT** | attire tous les ramassages + collecte auto | 12 s | `updatePickups` : vélocité vers le pilote | **très faible** |
| 13 | **COMBO GELÉ** | le compteur de combo ne se vide pas | 6 s | `comboT` gelé | **très faible** |
| 14 | **PRIME DE PEINTURE** | convertit 25 % de la couverture en score, immédiat | instantané | `coverage` → `score` + grande gerbe | faible |

## D. La signature du jeu : la peinture

| # | Bonus | Effet | Durée | Crochet existant | Coût |
| --- | --- | --- | --- | --- | --- |
| 15 | **PEINTURE VIVE** | les ennemis ralentissent de 30 % sur les zones peintes | 12 s | test de `covered[gw*gy+gx]` sous leurs pieds dans `updateEnemies` | faible |
| 16 | **MARÉE** | une vague de peinture recouvre 25 % du court et tout ce qu'elle touche | instantané | `splat` en nappe + dégâts sur la ligne de front | moyen |
| 17 | **NETTOYANT** | efface la peinture ennemie et rend le bonus de couverture ×1,5 | 12 s | `clearPaint` partiel + facteur sur le bonus de vague | faible |

## E. Duo / co-op

| # | Bonus | Effet | Durée | Crochet existant | Coût |
| --- | --- | --- | --- | --- | --- |
| 18 | **LIEN** | les deux pilotes partagent soin et bouclier | 10 s | boucle sur `pilots()` | faible |
| 19 | **REVIVE EXPRESS** | relève immédiatement un pilote à terre | instantané | `dead = false` + `hp = 3` (déjà fait en fin de vague) | **très faible** |

---

## Recommandation — « saison 1 » : 5 bonus, zéro usine à gaz

1. **BOUCLIER** (7) — la défense manque cruellement quand on prend des rafales.
2. **PEINTURE PERÇANTE** (1) — transforme une vague de rushers en moment de plaisir.
3. **DOUBLE SCORE** (11) — le risque/récompense le plus lisible qui soit.
4. **AIMANT** (12) — pure qualité de vie, surtout sur mobile.
5. **BOMBE À PEINTURE** (4) — le bonus signature : il joue à la fois le score et l'attaque.

**Saison 2**, une fois la première rodée : PEINTURE VIVE (15), REBOND (2), TURBO DASH (8),
REVIVE EXPRESS (19) en mode duo, MARÉE (16) en bonus légendaire.

## Règles à poser en même temps (pour ne pas déséquilibrer)

- **Raretés** : commun 60 % / rare 30 % / légendaire 10 %, avec la couleur de la caisse
  qui suit (actuellement la caisse est colorée par type, il suffit d'ajouter un liseré).
- **Un seul bonus actif à la fois** : un nouveau bonus remplace le précédent (le HUD
  affiche déjà `powerName` seul). Sinon il faut empiler l'HUD.
- **Drops** : passer à 28 % de chance, et 100 % garanti pour un boss (déjà le cas).
- **Anti-abuse** : aucun bonus ne doit rendre une vague finie farmable (pas de soin
  infini sur une vague sans ennemi).
- **Feedback** : chaque bonus garbe son propre son (`sfx`) et sa couleur de halo, comme
  les trois actuels — c'est ce qui rend la collecte satisfaisante.

## Ce que ça change dans le code (quand tu auras choisi)

| Fichier | Changement |
| --- | --- |
| `engine.ts` | type `Pickup.kind` élargi, table de drops, effets dans `updatePickups`, champs sur `Pilot` (`shield`, `pierce`, …) |
| `Hud.tsx` | affichage du bonus actif (déjà là) + jauge de bouclier |
| `audio.ts` | 2–3 sons de collecte supplémentaires |
| `Sheet.tsx` | mise à jour de la fiche de jeu |
