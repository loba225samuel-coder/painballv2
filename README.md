# PAINTBALL 2D — Splat Arena

Arène de paintball vue de dessus, 100 % canvas + React. Un build, un seul fichier HTML autonome, prêt pour Netlify.

**Technique :** React 19 · Vite 7 · Tailwind 4 (`@theme`) · TypeScript strict · Canvas 2D (court pré-bavé, éclats de peinture en sprites mis en cache) · WebAudio synthétisé (zéro asset son) · `vite-plugin-singlefile`.

---

## Mettre en ligne

Deux chemins, selon que tu veux un site qui suit Git ou juste une URL tout de suite.

### ⏱ Le plus rapide — zip + API Netlify (2 min, sans Git)

```bash
npm run build
```

Rends-toi sur **<https://app.netlify.com/drop>** et glisse le dossier **`dist/`** dans la zone prévue.
L'URL `https://<hasard>.netlify.app` s'affiche tout de suite ; *Site settings → Change site name* pour un nom propre.

Équivalent en ligne de commande (aucune installation, `curl` + `zip` seulement) :

```bash
NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh
# puis, une fois le site créé :
NETLIFY_AUTH_TOKEN=xxx NETLIFY_SITE_ID=yyy ./scripts/deploy.sh
```

Le token se crée sur *app.netlify.com → User actions → Personal access tokens*. Le script build, zipe `dist/`, pousse sur l'API et renvoie l'URL.

### Méthode 1 — import depuis Git (recommandé)

Le dépôt est **déjà initialisé et committé** ici (`git log` le confirme) : il ne manque que le remote.

```bash
# sur GitHub : « New repository », aucun fichier, ni README ni .gitignore
git remote add origin git@github.com:<ton-compte>/paintball-2d.git
git push -u origin main
```

Ensuite, sur Netlify :

1. **Add new site → Import an existing project** → choisir le dépôt.
2. Vérifier (ils sont déjà pré-remplis par le `netlify.toml`) :
   - Build command : `npm run build`
   - Publish directory : `dist`
3. **Deploy**, puis *Domain management* pour brancher un nom de domaine.

Chaque push sur la branche par défaut relance un build : la prod suit Git toute seule.

### Méthode 2 — glisser-déposer détaillé

```bash
npm install
npm run build          # génère dist/index.html, autonome (JS + CSS inlinés)
```

L'alternative au bouton : `./scripts/deploy.sh` (voir plus haut).

### Méthode 3 — CLI

```bash
npm i -g netlify-cli
netlify login
netlify link                    # ou : netlify init
netlify deploy                  # préversion, dans .netlify/ (ignoré par Git)
netlify deploy --prod
netlify dev                     # dév local avec la config du netlify.toml
```

---

## Publier à chaque push (optionnel, mais confortable)

Le dépôt embarque `.github/workflows/netlify.yml` : build + types + déploiement automatiques.

1. Pousse le projet sur GitHub (voir Méthode 1).
2. Crée le site sur Netlify une première fois (glisser-déposer suffit), puis note :
   - **Site ID** → *Site configuration → Identification*
   - **Access token** → *User applications → Personal access tokens*
3. Sur GitHub : *Settings → Secrets and variables → Actions* → ajoute `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID`.
4. `git push` → le site se met à jour, et chaque PR reçoit un aperçu jetable en commentaire.

Le workflow dépose aussi `dist/` en **artefact** (onglet Actions) : utile pour archiver ou redéployer à la main.

## Autres hébergeurs statiques

Le build ne produit qu'un `index.html` autonome : n'importe quel hébergeur statique convient.

| Hôte | Ce qu'il faut faire | Remarque |
| --- | --- | --- |
| **Cloudflare Pages** | Framework « Vite », build `npm run build`, dossier `dist` | Équivalent le plus proche de Netlify |
| **Vercel** | Détection Vite automatique | Rien à régler |
| **GitHub Pages** | Publier `dist/` sur la branche `gh-pages` | Sous-domaine `/<repo>/` : le manifeste et l'icône (`/manifest.webmanifest`, `/icons/…`) sont pointés en racine, donc l'installation « écran d'accueil » fonctionne moins bien — le jeu, lui, tourne |
| **N'importe quel serveur / S3 / OVH** | Copier le contenu de `dist/` à la racine | Aucun serveur applicatif nécessaire |

---

## Notes de déploiement

- **Cache** : `index.html` en `max-age=0, must-revalidate` (un déploiement est visible immédiatement) ; tout ce qui passerait par `/assets/*` est `immutable` un an.
- **En-têtes** : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (le jeu ne demande ni géoloc, ni caméra, ni micro), `Cross-Origin-Opener-Policy`.
- **Mobile** : `viewport-fit=cover` + `env(safe-area-inset-*)` — le HUD et le pad DASH évitent l'encoche et la barre d'accueil, et les limites du terrain s'ajustent en conséquence. Favicon et icône tactile en SVG inline (aucun fichier externe, donc aucun 404 possible). « Ajouter à l'écran d'accueil » lance le jeu en plein écran.
- **Polices** : Bungee + Barlow servies par Google Fonts (`preconnect` inclus pour le LCP). Pour un site 100 % auto-hébergé : `npm i @fontsource/bungee @fontsource/barlow`, remplacer le `<link>` par des `@import` en tête de `src/index.css`, puis `npm run build`.
- **Scores** : classement stocké dans le `localStorage` du navigateur (top 8 local, clé `pb2d.scores.v1`). Aucun back-end, aucun compte : chaque appareil garde son tableau. Pour un classement mondial, une fonction Netlify + un stockage (Blobs ou Tables) suffit — le moteur expose déjà un `RunResult` complet (score, vague, éclats, tirs, précision, série, couverture, temps) à l'écran de game-over.

## Version mobile

Le jeu détecte `(pointer: coarse)` et bascule en **schéma pouces** : deux pads flottants + un cluster de boutons sous le pouce droit.

| Zone | Action |
| --- | --- |
| Moitié gauche (glisser) | Se déplacer — le pad apparaît sous le doigt |
| Moitié droite (glisser) | Viser **et** tirer automatiquement en poussant à fond |
| Bouton **FEU** (maintenir) | Tir avec auto-visée sur la cible la plus proche ; l'anneau montre le chargeur |
| Bouton **DASH** | Dash + i-frames, anneau de recharge |
| Bouton **CHARGE** | Rechargement manuel (auto à 0 bille) |

Adaptations mobiles :

- **Plein écran réel** : le canvas occupe tout le viewport, sans bandes noires. En multijoueur, une caméra suit le joueur (ou le milieu des deux joueurs en local), avec mini-carte et flèches de hors-champ.

- **Plein écran** demandé au premier `JOUER` (là où l'API existe), puis bouton dans le HUD et la pause. Sinon, « Ajouter à l'écran d'accueil » + `manifest.webmanifest` : lancement en `fullscreen`, `orientation: landscape`.
- **`viewport-fit=cover` + `env(safe-area-inset-*)`** : HUD, pads et bouton DASH évitent l'encoche ; les limites du terrain s'ajustent (max 20 px CSS par bord).
- **Paysage conseillé** : un encart tourné apparaît en portrait au premier lancement (dismissible, mémorisé). En portrait le moteur zoome aussi (court ≈ 520×1125 au lieu de 640×1385) pour garder le combat dense, et le nombre d'ennemis simultanis est plafonné à 9.
- **Haptique** : `navigator.vibrate` sur dash (14 ms), éclat encaissé, élimination et mort du boss. Bouton de coupure dans le HUD et la pause (`V` au clavier).
- **Assistance de visée** au stick droit (aimant à ±0,3 rad) et pied mort de 7 px : un pouce n'est pas une souris.
- **Budget FX** : particules plafonnées à 430 (760 sur desktop), pas de scanlines, DPR bridé sur grands écrans — 60 fps visé sur téléphone milieu de gamme.
- **Rotation = pause** automatique, pour ne pas mourir pendant le reflow.
- **Wake lock** : l'écran ne s'éteint pas pendant une partie (re-demandé au retour d'onglet).

## Sauvegarde de progression (Supabase)

Le jeu peut garder une **carrière complète** : pseudo, couleur, grade, record, score cumulé, meilleure vague, précision, couverture, temps de jeu, historique des parties et classement cloud par mode.

- Projet : `https://ipdohwwyletjrkdrlyma.supabase.co`
- Migrations : [`202610280001_progression.sql`](./supabase/migrations/202610280001_progression.sql) puis [`202610280002_saved_runs.sql`](./supabase/migrations/202610280002_saved_runs.sql)
- Guide : [`supabase/README.md`](./supabase/README.md)

### Activation (une seule fois)

1. Supabase → **SQL Editor** : collez la migration `202610280001_progression.sql`, puis **Run** ; faites de même avec `202610280002_saved_runs.sql`.
2. Supabase → **Authentication → Providers** : activez **Anonymous Sign-Ins** (le mode invité). L’email est déjà actif.
3. Supabase → **Authentication → URL Configuration** : mettez votre URL Netlify en `Site URL`, et ajoutez `http://localhost:5173/**` en Redirect URLs.
4. Netlify → **Environment variables** :
   ```
   VITE_SUPABASE_URL=https://ipdohwwyletjrkdrlyma.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_…
   ```
   Puis redéployez. En local, `.env.example` fournit les mêmes variables.

### Utilisation

Accueil → **PROGRESSION** → **Continuer en invité** (ou lien magique par email).
Chaque partie solo, coop ou versus terminée est enregistrée automatiquement. Les réglages son/vibration et le pseudo sont synchronisés. Sans connexion, le jeu garde le secours local (`localStorage`).

### Reprendre une partie plus tard

En solo, un petit bouton **SAUVER** est visible dans le HUD (et `Ctrl+S`). La pause propose **SAUVEGARDER ET QUITTER**.
À l’accueil, une carte **PARTIE EN COURS · VAGUE 5** permet de **REPRENDRE** : score, vague, ennemis, bonus, couverture et peinture du terrain sont restaurés. La sauvegarde est locale, et cloud si le joueur est connecté. Elle s’adapte à un autre écran / une autre orientation.

### Sécurité

La clé `sb_publishable_…` est publique : elle identifie le projet, elle ne donne pas tous les droits.
Les tables ont **RLS** activée ; un joueur ne lit que ses lignes. L’écriture des parties/stats passe par `record_run()` en `security definer`, qui prend l’identité dans le JWT et borne les valeurs. Le classement public ne renvoie que pseudo, couleur, score, vague, couverture, grade et date.

## Bonus ramassables

Les capsules apparaissent après les éliminations, avec une table de drop partagée entre solo et multijoueur.

| Bonus | Effet | Durée / charges |
| --- | --- | --- |
| **Soin / Peinture** | Rend 2 points de vie. | instantané |
| **Overclock** | Recharge complète + tir rapide. | 5 s |
| **Triple jet** | Trois projectiles par tir. | 9 s |
| **Bouclier de peinture** | Absorbe 2 impacts, bulle visible autour du joueur. | 10 s / 2 charges |
| **Ricochet** | Les projectiles rebondissent une fois sur les bunkers. | 8 s |
| **Bille explosive** | Le prochain tir explose en zone, endommage les groupes et peint largement. | 1 charge, max 2 |
| **Rouleau de peinture** | Le joueur peint le sol en se déplaçant. | 6 s |

Les bonus actifs sont affichés dans le HUD avec icône, nom, durée restante et charges. En multijoueur, ils apparaissent aussi sur les cartes joueurs. Les effets sont sauvegardés avec la partie en cours.

## Multijoueur progressif

Le solo est inchangé. Depuis l’accueil, **MULTIJOUEUR** ouvre un écran dédié avec trois étapes :

1. **COOP à 2, même écran** — deux joueurs, vagues partagées, pas de tir allié, réanimation en restant 1,5 s près du coéquipier à terre.
2. **COOP en ligne, salon privé** — code à 6 caractères, lien d’invitation, salon prêt/pas prêt, reconnexion 20 s.
3. **VERSUS 1 contre 1** — 90 s, réapparition rapide, chaque case peinte peut être volée à l’adversaire ; le territoire compte dans le score final.

### Commandes du duo local

| | Joueur 1 | Joueur 2 |
| --- | --- | --- |
| Clavier | WASD + souris · Espace tirer · Maj dash · R charger | Flèches · IJKL viser · Entrée tirer · Maj droit dash · Retour charger |
| Manette | 1ʳᵉ manette si deux sont branchées | 2ᵉ manette, ou la seule manette branchée |
| Mobile | Tactile (gauche bouge, droite vise, FEU/DASH/CHG) | Manette conseillée ; sinon préférez le mode en ligne |

### Jouer en ligne tout de suite (local)

```bash
# terminal 1 : serveur de salons
npx tsx server/index.ts

# terminal 2 : front
VITE_MULTIPLAYER_URL=ws://localhost:8787 npm run dev
```

Créez un salon, partagez le code, ouvrez une seconde fenêtre. Le serveur est autoritaire : il valide tirs, dégâts, scores et peinture.

### Mettre le multijoueur en production

1. Déployez le serveur avec le blueprint **`render.yaml`** (Render → New → Blueprint), ou sur Fly.io / un VPS avec `npx tsx server/index.ts`.
2. Sur Netlify, ajoutez la variable d’environnement :
   ```
   VITE_MULTIPLAYER_URL=wss://votre-serveur.onrender.com
   ```
3. Redéployez le front. Sans cette variable, le duo local reste jouable et l’écran en ligne explique quoi configurer.

Détails du protocole, variables et reconnexion : [`server/README.md`](./server/README.md).

### Sous le capot

- `src/game/rules.ts` : constantes communes (court, ennemis, joueur).
- `src/game/mpSim.ts` : simulation pure, utilisée par le duo local **et** le serveur.
- `src/game/multiplayer.ts` : rendu, entrées clavier/manettes/tactile, prédiction locale + réconciliation.
- `server/index.ts` : salons WebSocket, 60 Hz, snapshots 20 Hz, heartbeat, limites anti-abus.

## Jouer

| Clavier | Action | Tactile |
| --- | --- | --- |
| `W A S D` / flèches | Se déplacer | Glisser sur la moitié gauche |
| Souris | Viser | Glisser sur la moitié droite (tir auto en poussant) |
| `Clic G` / `Espace` | Arroser le terrain | — (automatique) |
| `Maj` | Dash + i-frames | Pad DASH |
| `R` | Recharger | — (auto à 0 bille) |
| `P` / `Échap` | Pause | Bouton pause en haut à droite |
| `M` / `V` / `F` | Son / vibration / plein écran | Boutons son, vibration, plein écran |

Le principe : éclabousser les vagues, enchaîner les splats pour le multiplicateur (jusqu'à x6) et **peindre le court** — chaque tir raté tache le sol, et la couverture de peinture est versée en bonus à la fin de la vague. Boss tous les 5 niveaux.

## Scripts

```bash
npm run dev       # Vite + HMR
npm run build     # → dist/ (index.html autonome ~321 Ko, ~97 Ko gzip + manifeste/icône)
npm run preview   # sert le build localement
npx tsc --noEmit  # typage strict
```

## Structure

```
index.html                  méta plein écran, manifeste, favicon SVG inline, polices
public/                     manifest.webmanifest (fullscreen + paysage) + icône d'installation
render.yaml                 blueprint du serveur de salons (Render)
.env.example                VITE_MULTIPLAYER_URL
netlify.toml                build + publish + redirect + en-têtes + [dev]
.nvmrc / .gitignore         parité Node avec Netlify, exclusions
src/App.tsx                 monte le canvas, orchestre menu / jeu / pause / game-over
src/game/engine.ts          boucle solo 60 fps, IA, collisions, peinture du sol, particules
src/game/rules.ts           règles communes solo / multijoueur
src/game/mpSim.ts           simulation multijoueur pure (local + serveur)
src/game/multiplayer.ts     client multijoueur : rendu, entrées, réseau, prédiction
src/game/mpProtocol.ts      messages client / serveur
server/index.ts             serveur de salons autoritaire (ws)
src/game/audio.ts           kit de SFX synthétisé (WebAudio)
src/components/Hud.tsx      HUD in-game (jauge de peinture, vague, combo, couverture, munitions)
src/components/Screens.tsx  démarrage, pause, game-over + signature du tableau
src/lib/scores.ts           tableau des records local (secours)
src/lib/supabase.ts         client Supabase (clé publishable)
src/hooks/useProgression.ts session, stats, historique, classement, sauvegarde auto
src/components/Progression.tsx  vestiaire : compte, carrière, classement
supabase/migrations/        schéma SQL + RLS + fonctions + sauvegardes en cours
```
