# PAINTBALL 2D — Splat Arena

> Arène de paintball vue de dessus, à la croisée d'un arcade à l'ancienne et d'un jeu de peinture.
> Tout ce que tu rates, tu le peins. Et ce que tu peins, ça rapporte.

**React 19 · Vite 7 · TypeScript strict · Canvas 2D · WebAudio · WebRTC · Supabase · Netlify**

Jouable au clavier comme au doigt, seul, à deux sur le même écran, ou en co-op en ligne dans un salon privé.
Un build, un seul fichier HTML autonome, déployable n'importe où.

---

## Le principe

Tu pilotes un marqueur de paintball dans une arène fermée. Les adversaires arrivent par vagues ; chacun que
tu éclabousses paie des points, et **chaque tir manqué tache le sol**. Le terrain peint n'est pas un décor :
il est mesuré en continu et versé en **bonus de fin de vague**. Autrement dit, même quand tu paniques et que
tu arroses dans tous les sens, tu travailles pour ton score.

À cela s'ajoute le **combo** : enchaîner les splats sans te faire toucher fait monter le multiplicateur
(jusqu'à **x7**). Le jeu demande donc deux choses en même temps — être précis, et être sale.

---

## Fonctionnalités

### Le combat
- **Vagues infinies** qui montent en puissance (3 + 1,7 × n adversaires, jusqu'à 15 simultanés).
- **4 types d'adversaires** avec des comportements distincts : le GRAUNT qui tient la position, le RUSHER
  qui charge et percute, le SNIPER qui annonce son tir par un laser, et le **BOSS** toutes les 5 vagues
  (rafales en éventail, 420 PV, gros butin).
- **Marqueur complet** : chargeur de 12 billes, recharge à la demande ou automatique, dash à i-frames,
  recul, dispersion de tir, jauge de munitions au-dessus de ta tête.
- **7 ramassages** : OVERCLOCK, TRIPLE STREAM, +PAINT, BOUCLIER, RICOCHET, BILLE EXPLOSIVE, ROULEAU —
  chacun avec sa couleur, son halo et son son.
- **Effets jouissifs** : tremblement d'écran gradué au trauma, gel d'image à l'éclat, flashs colorés,
  particules, ondes de choc, textes flottants, éclats de peinture qui deviennent des décors permanents.

### Les modes
| Mode | Description |
| --- | --- |
| **SOLO** | le classique : un pilote, les vagues, le score |
| **DUO LOCAL** | deux pilotes sur un même clavier (WASD + flèches), revive en fin de vague |
| **CO-OP EN LIGNE** | salon privé à 4 lettres, WebRTC, hôte autoritaire |
| **VERSUS 1v1** | à venir — le seul qui exige un vrai netcode compétitif |

### Le confort
Pause complète · **sauvegarde de partie** (« revenir plus tard », reprise exacte en plein milieu d'une vague) ·
plein écran · son et vibration activables · écran qui ne s'éteint pas pendant une partie ·
rotation du téléphone = pause automatique · auto-visée au pouce · HUD complet et lisible en un coup d'œil.

### La progression
Records et statistiques sauvegardés (meilleur score, vague max, éclats, temps de jeu, peinture cumulée),
**classement mondial**, historique des parties, et sauvegarde de partie synchronisée entre appareils.
Tout fonctionne **hors ligne** (repli localStorage) et se synchronise dès que le réseau revient.

---

## Les chiffres du jeu

| Élément | Valeur |
| --- | --- |
| Vie | 6 peintures · 1,15 s d'invulnérabilité après un éclat |
| Chargeur | 12 billes · recharge 0,95 s |
| Cadence | 0,108 s par tir · 0,062 s en OVERCLOCK |
| Dash | 0,17 s de propulsion · 1,05 s de recharge · 0,34 s de i-frames |
| Combo | x1 → x7 (seuils 2 / 4 / 7 / 11 / 16 / 22 splats) · fenêtre 3,4 s |
| Bonus de vague | 220 × vague + couverture de peinture × 1 400 · +1 PV |
| GRAUNT | 60 PV · 120 pts |
| RUSHER | 48 PV · 170 pts |
| SNIPER | 52 PV · 220 pts |
| BOSS | 420 PV · 1 600 pts |
| Drops | 24 % à la mort · 100 % premium sur un boss |

---

## Comment jouer

| Clavier | Action | Tactile |
| --- | --- | --- |
| `W A S D` / flèches | Se déplacer | Glisser sur la moitié gauche |
| Souris | Viser | Glisser sur la moitié droite (tir auto en poussant) |
| `Clic` / `Espace` | Arroser | — (automatique) |
| `Maj` | Dash + i-frames | Pad **DASH** |
| `R` | Recharger | Pad **CHARGE** |
| `P` / `Échap` | Pause | Bouton pause |
| `M` / `V` / `F` | Son / vibration / plein écran | Boutons dédiés |

En **duo**, le pilote 2 utilise les flèches, `Entrée` pour tirer, `Maj droit` pour dasher et `.` pour recharger.

---

## Sous le capot

### Architecture
Le jeu est une application React **montée autour d'un canvas**. React ne gère que les écrans (accueil, pause,
fin de partie) et le HUD ; toute la boucle de jeu vit dans une classe autonome qui ne connaît pas React :

```
src/game/engine.ts    boucle 60 fps, IA, collisions, peinture, particules, sauvegarde, snapshots
src/game/audio.ts     kit de sons synthétisés (WebAudio, zéro fichier audio)
src/game/net.ts       protocole multi-joueur + client WebRTC
src/components/       Hud, écrans, fiche de jeu, panneaux en ligne
src/lib/              scores locaux, progression Supabase
```

Cette séparation est volontaire : le moteur peut être testé **sans navigateur** (je l'exécute dans un harnais
Node avec un canvas simulé pour vérifier les collisions, les vagues, la sauvegarde ou le protocole réseau).

### La boucle de jeu
`requestAnimationFrame` avec un pas de temps borné (jamais plus de 1/15 s, pour éviter l'effet catapulte après
un onglet en arrière-plan). Le gel d'image (*hitstop*) est appliqué en mettant simplement le pas à zéro : les
impacts semblent « mordre » sans jamais désynchroniser la simulation.

### La peinture
C'est la pièce maîtresse. Le terrain possède **deux couches** :
- un décor **pré-cuit** une seule fois (sol, lignes, bunkers, marquages, vignettage) ;
- une couche de **peinture dynamique** sur laquelle on tamponne des sprites d'éclats pré-rendus (4 variantes
  par couleur, mis en cache) — jamais de dégradé ni de filtre par image.

Une **grille de couverture** (une cellule de 46 px) alimente le score, ce qui permet de sérialiser l'état du
terrain en quelques centaines d'octets. C'est ce qui rend la sauvegarde de partie légère.

### Le son
Aucun fichier audio : les sons sont **synthétisés à la volée** (oscillateurs + bruit filtré). Gain master,
déclenchement depuis un geste utilisateur (politique d'autoplay), et un son différent par événement —
c'est ce qui donne sa « texture » à chaque éclat.

### Le netcode (co-op en ligne)
- **Hôte autoritaire** : l'hôte simule tout. Le client n'envoie que ses **entrées** (6 champs, ~30 Hz) ;
  l'hôte diffuse un **snapshot** (~200 octets, 20 Hz) avec les positions, PV, munitions et score.
- Le client est une **réplique** : la peinture et les particules sont calculées localement (cosmétique).
- **Pas de rollback ici** : en co-op on coopère. C'est le versus qui imposera la prédiction + rollback.
- **Signalisation** : une Netlify Function (`netlify/functions/signal.ts`) stocke l'offre/réponse du salon dans
  Netlify Blobs. En cas d'indisponibilité, l'interface bascule sur un **échange manuel** de SDP.

### La sauvegarde
`exportSave()` produit un état complet : score, vague, pilotes (PV, munitions, pouvoirs), ennemis vivants,
vagues à venir, **grille de couverture** et une image compressée du court. `importSave()` restaure le tout —
y compris sur un **autre format d'écran** (la grille est rééchantillonnée sans perte). Stockage double :
`localStorage` (immédiat, hors ligne) + table Supabase (suit le joueur d'un appareil à l'autre).

### Performance
Décor pré-cuit, sprites d'éclats en cache, particules plafonnées (760 sur desktop, 430 sur mobile),
densité de pixels réduite sur grands écrans, pas de scanlines sur mobile. Le canvas **ne fige jamais sa
taille en pixels** : le CSS pilote l'affichage, le moteur ne gère que la résolution interne, et il revérifie
la taille toutes les 8 images en plus d'un `ResizeObserver` — c'est ce qui garantit que le jeu remplit
l'écran à la rotation comme au rétractage de la barre d'URL.

---

## Démarrage

```bash
npm install
npm run dev        # serveur de développement + HMR
npm run build      # -> dist/index.html autonome (~586 ko, ~168 ko gzip)
npm run preview    # sert le build localement
npx tsc --noEmit   # typage strict
```

Node 22 recommandé (voir `.nvmrc`).

---

## Déploiement

Le dépôt contient déjà [`netlify.toml`](./netlify.toml) : build `npm run build`, publish `dist`, Node 22,
redirect SPA, en-têtes de cache et de sécurité, et le dossier des fonctions. Netlify le lit automatiquement.

| Méthode | Comment |
| --- | --- |
| **Git (recommandé)** | Netlify → *Add new site → Import an existing project*. Chaque push sur `main` publie. |
| **Glisser-déposer** | `npm run build` puis déposer `dist/` sur <https://app.netlify.com/drop> |
| **Script** | `NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh` (crée le site, renvoie l'URL) |
| **CI** | `.github/workflows/netlify.yml` : types + build + déploiement à chaque push, aperçu par PR |

Pour activer la CI, ajoute les secrets `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID` dans
*GitHub → Settings → Secrets and variables → Actions*.

Le build est **autonome** (JS et CSS inlinés par `vite-plugin-singlefile`) : n'importe quel hébergeur statique
convient — Cloudflare Pages, Vercel, un bucket S3, un simple serveur web.

---

## Base de données (Supabase)

Le jeu fonctionne **sans base** (tout est en local). Supabase ajoute la progression et le classement mondial.

| Objet | Rôle |
| --- | --- |
| `profiles` | progression agrégée (record, vague max, éclats, parties, temps, peinture cumulée) |
| `runs` | chaque partie terminée, figée ensuite (anti-triche douce) |
| `leaderboard` | vue top 50 mondiale, lisible par tout le monde |
| `saves` | une sauvegarde de partie par joueur, privée (RLS) |
| `submit_run()` | RPC : dépose la partie **et** met à jour la progression en une passe |
| `handle_new_user()` | trigger : tout nouveau compte (y compris anonyme) a son profil |

Sécurité par **RLS** : chacun n'écrit que ses lignes, les classements sont publics, et un score déposé ne peut
plus être modifié. Le compte est **anonyme** (aucun mot de passe), créé à la **première écriture** seulement —
une simple visite ne remplit donc pas la base.

Installation : coller [`supabase/schema.sql`](./supabase/schema.sql) dans le SQL Editor, puis activer
*Authentication → Sign In / Up → Anonymous sign-ins*. Le fichier est réexécutable. Les requêtes d'entretien
(purge des visiteurs sans partie, comptes orphelins) sont en fin de fichier, section **ENTRETIEN**.

---

## Multijoueur — par paliers

Le solo ne bouge jamais : chaque palier est **additif**.

| Palier | État | Détail |
| --- | --- | --- |
| 1. Co-op 2 joueurs, même écran | ✅ | deux pilotes, revive en fin de vague, score partagé |
| 2. Co-op en ligne, salon privé | ✅ (bêta) | WebRTC + Netlify Function, code à 4 lettres |
| 3. Versus 1 contre 1 | ⏳ | nécessite prédiction + rollback, état de peinture synchronisé (RLE) |

Le protocole (champs échangés, fréquences, repli manuel) est détaillé dans le README de `src/game/net.ts`.

---

## Mobile

Le jeu est pensé **pouce d'abord** : deux pads flottants (déplacement à gauche, visée + tir à droite), un
cluster de trois boutons (FEU, DASH, CHARGE) sous le pouce droit, assistance de visée, retour haptique,
plein écran au lancement, et un `manifest.webmanifest` pour « Ajouter à l'écran d'accueil »
(lancement en plein écran, orientation paysage). La rotation ne perd rien : partie, peinture et couverture
sont conservées, et les insets d'encoche sont gérés partout.

---

## Évolutions prévues

- **Bonus** : 19 idées classées par famille et par coût technique dans
  [`docs/bonus-ramassables.md`](./docs/bonus-ramassables.md) — 4 déjà implémentés (bouclier, ricochet,
  bille explosive, rouleau).
- **Versus 1v1** : court fermé, 3 minutes, duel de peinture.
- **Profils nommés** : vraie authentification (magic link) pour retrouver sa progression partout.

---

## Structure du projet

```
index.html                    méta plein écran, manifeste, favicon SVG inline, polices
netlify.toml                  build + publish + redirect + en-têtes
.github/workflows/netlify.yml CI de déploiement
scripts/deploy.sh             publication directe via l'API Netlify
supabase/schema.sql           base de données complète (tables, RLS, RPC, entretien)
docs/bonus-ramassables.md     conception des extensions de gameplay
public/                       manifeste d'installation + icône
src/game/engine.ts            le moteur (~3 400 lignes)
src/game/audio.ts             sons synthétisés
src/game/net.ts               protocole + client WebRTC
src/components/               Hud, Screens, Online, Progress, Sheet
src/lib/scores.ts             records locaux
src/lib/cloud.ts              progression et sauvegardes Supabase
```

---

## Licence

Projet personnel. Le code est public, les noms PAINTBALL 2D et Splat Arena le sont aussi — réutilise,
modifie, expérimente.
