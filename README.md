# PAINTBALL 2D — Splat Arena

Arène de paintball vue de dessus, 100 % canvas + React. Un build, un seul fichier HTML autonome, prêt pour Netlify.

**Technique :** React 19 · Vite 7 · Tailwind 4 (`@theme`) · TypeScript strict · Canvas 2D (court pré-bavé, éclats de peinture en sprites mis en cache) · WebAudio synthétisé (zéro asset son) · `vite-plugin-singlefile`.

---

## Pourquoi la base se remplit toute seule

`profiles` reçoit une ligne par joueur, **automatiquement** : le trigger `on_auth_user_created` crée un profil
à chaque compte, et le jeu crée un compte anonyme **au premier enregistrement** (partie terminée ou partie
sauvegardée) — plus à la simple visite depuis la mise à jour « lecture sans compte ». Les lignes
`total_runs = 0` sont donc des navigateurs qui ont lancé le jeu sans terminer de partie (tests, curieux,
navigation privée qui repart de zéro).

La table `players`, elle, n'est écrite par aucun code de ce projet : si elle existe dans ton Supabase, elle
vient d'un essai ou d'un template — `drop table public.players;` si elle ne sert à rien.

Les requêtes de nettoyage (visiteurs sans partie, comptes anonymes orphelins) sont en fin de
`supabase/schema.sql`, section **ENTRETIEN**.

## Sauvegarde de partie — « revenir plus tard »

Le joueur arrive vague 5, il est fatigué : **PAUSE → SAUVEGARDER & QUITTER**. La partie complète est stockée et
reprend exactement là où elle s'était arrêtée.

- **Bouton** dans l'écran de pause, sous REPRENDRE : « SAUVEGARDER & QUITTER ».
- **Carte « PARTIE EN COURS »** sur l'écran de démarrage : vague atteinte, score, ancienneté, bouton
  **REPRENDRE LA PARTIE** et **SUPPRIMER**.
- **Ce qui est conservé** : score, vague, éliminations, précision, combo, temps, pilotes (PV, munitions,
  pouvoirs), ennemis en cours de vague, vagues restantes à spawn, **couverture de peinture** et une image du
  court peint. La reprise se fait au milieu de la vague, pas au début.
- **Deux emplacements** : `localStorage` (immédiat, hors ligne) + table `saves` de Supabase (suit le joueur
  d'un appareil à l'autre). L'un des deux suffit ; les deux sont remplis.
- **Sécurité** : pas de sauvegarde pendant une mort / game over, et une partie terminée supprime la sauvegarde
  (pas de reprise truquée).
- **Changement d'écran** : la grille de couverture est rééchantillonnée sur la taille courante — on reprend sur
  un téléphone après un PC sans tout perdre.

Fichiers : `exportSave()` / `importSave()` dans `src/game/engine.ts`, stockage dans `src/lib/cloud.ts`
(`saveLocal` / `pushSave` / `pullSave`), interface dans `src/components/Screens.tsx` (`ResumeCard`).

## Prochaines idées de bonus ramassables

Le jeu en a trois (OVERCLOCK, TRIPLE STREAM, +PAINT). Une liste d'extensions **proposées mais pas
implémentées** est dans [`docs/bonus-ramassables.md`](./docs/bonus-ramassables.md) : 19 idées classées
(attaque, défense, score, peinture, duo), chacune avec son crochet technique et son coût réel dans le
moteur, plus une recommandation « saison 1 » de 5 bonus à faible risque.

## Multijoueur — par paliers

Le solo ne bouge pas : chaque palier est **additif**, et le mode est choisi à l'écran de démarrage.

| Palier | État | Ce qui tourne |
| --- | --- | --- |
| **1. Co-op 2 joueurs, même écran** | ✅ livré | 2 pilotes, 1 clavier (WASD + flèches), revive en fin de vague |
| **2. Co-op en ligne, salon privé** | ✅ branché (bêta) | WebRTC + Netlify Function, code à 4 lettres, hôte autoritaire |
| **3. Versus 1 contre 1** | ⏳ à venir | nécessite prédiction + rollback sur les tirs (netcode compétitif) |

### Palier 2 — co-op en ligne

Sur l'écran de démarrage : **CRÉER UN SALON** (un code à 4 lettres s'affiche, à partager) ou **REJOINDRE** avec le code. Dès la connexion, la partie démarre en mode duo : l'hôte tient le pilote 1, le client le pilote 2 (commandes primaires : WASD/souris chez lui aussi).

Architecture assumée, pour ne pas faire d'usine à gaz :

- **Hôte autoritaire** : l'hôte simule tout. Le client n'envoie que ses entrées (`mx, my, aim, fire, dash, reload`) à 30 Hz ; l'hôte diffuse un snapshot (~200 o : pilotes, ennemis, score) à 20 Hz.
- **Le client est une réplique** : positions, PV et score viennent de l'hôte ; la peinture et les particules sont calculées localement (pur cosmétique).
- **Pas de rollback ici** : la co-op coopère, la triche n'est pas un enjeu. C'est le versus qui exigera la prédiction + rollback — c'est pour ça qu'il arrive après.
- **Signalisation** : `netlify/functions/signal.ts` (Netlify Blobs, salons auto-expirés à 5 min). Si la fonction n'est pas déployée, l'interface bascule en **échange manuel** (copier-coller l'offre puis la réponse entre les deux joueurs) : le jeu reste joignable sans backend.
- **Déconnexion** : retour propre au solo/duo local, sans casser la partie en cours.

Fichiers : `src/game/net.ts` (protocole + client WebRTC), `netlify/functions/signal.ts` (signalisation), `src/components/Online.tsx` (salons, états vides/attente/erreur/manuel).

### Palier 3 — versus 1 contre 1 (à venir)

Court fermé, 3 min, qui peint le plus gagne. Il demandera : tick serveur partagé, prédiction client + rollback sur les tirs, et un état de peinture synchronisé (RLE des cellules). Le gameplay est déjà découplé par pilote, donc cela se greffe sans réécrire le moteur.

## Multijoueur (local)

### Couches 1 et 2 — livrées : DUO LOCAL (2 pilotes, 1 écran)

Sélecteur de mode sur l'écran de démarrage : **SOLO** ou **DUO LOCAL**.

| | Pilote 1 (cyan) | Pilote 2 (vert) |
| --- | --- | --- |
| Déplacement | `W A S D` | Flèches |
| Viser | Souris (ou auto-visée) | Auto-visée (le plus proche) |
| Tirer | `Clic` / `Espace` | `Entrée` / `Numpad 0` / `/` |
| Dash | `Maj gauche` | `Maj droit` / `Ctrl droit` |
| Recharger | `R` | `.` / `Numpad .` |

Règles duo : score partagé, compteur de splats par pilote, et **revive en fin de vague** (3 PV, 2,4 s d'invulnibilité) — un pilote qui tombe ne met pas fin à la partie, seul un double KO déclenche le game over. En solo, les flèches restent au pilote 1, tout est comme avant.

### Couche 3 — en ligne temps réel (roadmap, pas encore branchée)

1. **Signalisation** : Netlify Function + Blobs pour les salons (code à 4 lettres) ou broker PeerJS.
2. **Transport** : WebRTC DataChannel (P2P) avec repli WebSocket.
3. **Protocole** : on synchronise les *inputs* (60–90 bits), jamais l'état complet ; snapshot d'état (1 ko) uniquement pour le rattrapage toutes les ~3 s.
4. **Netcode** : tick serveur 20–30 Hz, interpolation 100–150 ms côté spectateur, **prédiction client + rollback** sur les tirs, hôte autoritaire (l'hôte simule, les autres suivent) pour l'anti-triche.
5. **Confort** : reconnexion dans la partie, ping affiché, mode spectateur, fin de partie figée.

Ce qu'il faut pour la déployer : un compte Netlify (Functions) et le choix hôte (Netlify + Blobs, ou service externe) — le gameplay lui est déjà découplé par pilote, donc le netcode pourra s'y brancher sans réécrire le moteur.

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

- **Plein écran** demandé au premier `JOUER` (là où l'API existe), puis bouton dans le HUD et la pause. Sinon, « Ajouter à l'écran d'accueil » + `manifest.webmanifest` : lancement en `fullscreen`, `orientation: landscape`.
- **`viewport-fit=cover` + `env(safe-area-inset-*)`** : HUD, pads et bouton DASH évitent l'encoche ; les limites du terrain s'ajustent (max 20 px CSS par bord).
- **Paysage conseillé** : un encart tourné apparaît en portrait au premier lancement (dismissible, mémorisé). En portrait le moteur zoome aussi (court ≈ 520×1125 au lieu de 640×1385) pour garder le combat dense, et le nombre d'ennemis simultanis est plafonné à 9.
- **Haptique** : `navigator.vibrate` sur dash (14 ms), éclat encaissé, élimination et mort du boss. Bouton de coupure dans le HUD et la pause (`V` au clavier).
- **Assistance de visée** au stick droit (aimant à ±0,3 rad) et pied mort de 7 px : un pouce n'est pas une souris.
- **Budget FX** : particules plafonnées à 430 (760 sur desktop), pas de scanlines, DPR bridé sur grands écrans — 60 fps visé sur téléphone milieu de gamme.
- **Rotation = pause** automatique, pour ne pas mourir pendant le reflow.
- **Wake lock** : l'écran ne s'éteint pas pendant une partie (re-demandé au retour d'onglet).
- **Taille plein écran garantie** : le canvas ne fige plus sa taille affichée en pixels (bug qui laissait le
  jeu réduit à un coin d'écran quand la première mesure tombait pendant la barre d'URL). Le CSS pilote
  l'affichage, le moteur ne gère que la résolution interne — et il **revérifie la taille toutes les 20 images**,
  en plus d'un `ResizeObserver` et de `visualViewport`, pour absorber barre d'URL, rotation et clavier virtuel.
  Vérifié en simulation : 390×640 → 390×844 → 844×390 → mesure nulle → 360×780, le terrain remplit toujours
  exactement l'écran.

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
| Duo : `Entrée`, `Maj droite`, `.` | Tir / dash / charge du pilote 2 | — (mode duo = clavier) |

Le principe : éclabousser les vagues, enchaîner les splats pour le multiplicateur (jusqu'à x7 : 2/4/7/11/16/22 splats enchaînés) et **peindre le court** — chaque tir raté tache le sol, et la couverture de peinture est versée en bonus à la fin de la vague. Boss tous les 5 niveaux.

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
netlify.toml                build + publish + redirect + en-têtes + [dev]
.nvmrc / .gitignore         parité Node avec Netlify, exclusions
src/App.tsx                 monte le canvas, orchestre menu / jeu / pause / game-over
src/game/engine.ts          boucle 60 fps, IA, collisions, peinture du sol, particules, tremblements
src/game/audio.ts           kit de SFX synthétisé (WebAudio)
src/components/Hud.tsx      HUD in-game (jauge de peinture, vague, combo, couverture, munitions)
src/components/Screens.tsx  démarrage, pause, game-over + signature du tableau
src/lib/scores.ts           tableau des records local
```
