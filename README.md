# PAINTBALL 2D — Splat Arena

**Un arcade de paintball vue de dessus, nerveux et coloré, jouable au clavier, à la souris, au tactile et à la manette.**  
Tu tiens un marqueur, tu tiens un court, tu tiens une vague. Chaque bille manquée tache le terrain — et le terrain rapporte des points.

Dépôt : <https://github.com/loba225samuel-coder/painballv2>

---

## 1. Le projet en bref

PAINTBALL 2D est un jeu d’arène complet dans le navigateur :

- **solo** : survivre à des vagues d’adversaires, enchaîner les splats, peindre le court ;
- **duo local** : deux joueurs sur le même écran, en coopération ou en duel ;
- **en ligne** : salons privés, serveur autoritaire, reconnexion ;
- **progression** : profil, grade, statistiques, historique, classement cloud ;
- **sauvegarde en cours de partie** : quitter à la vague 5, reprendre plus tard ;
- **mobile** : plein écran réel, commandes pouce, caméra adaptée, haptique.

L’objectif n’est pas seulement de tirer : c’est de **contrôler l’espace**. Les bunkers bloquent les tirs, les ricochets les contournent, les explosions nettoient les groupes, le rouleau transforme les déplacements en territoire.

### Stack

| Couche | Choix |
| --- | --- |
| Interface | React 19, TypeScript strict, Tailwind CSS 4 (`@theme`) |
| Build | Vite 7 + `vite-plugin-singlefile` |
| Jeu | Canvas 2D, boucle `requestAnimationFrame`, aucune dépendance de moteur de jeu |
| Audio | WebAudio synthétisé, zéro fichier son |
| Icônes | Lucide |
| Typographie | Bungee pour l’affichage, Barlow / Barlow Semi Condensed pour le texte |
| Multijoueur | Node.js + `ws`, simulation partagée, snapshots |
| Données | Supabase Auth + Postgres + RLS |
| Déploiement | Netlify pour le front, Render / Fly / VPS pour le serveur de salons |

---

## 2. Fonctionnalités

### 2.1 Solo : vagues, score et peinture

Le mode solo est une survie en vagues.

- **Vagues progressives** : ennemis plus nombreux, plus rapides, plus résistants.
- **Boss toutes les 5 vagues**, avec salves et pression accrue.
- **Plusieurs archétypes d’ennemis** :
  - tireurs classiques qui cherchent la ligne de vue ;
  - rushers qui foncent au contact ;
  - snipers qui chargent un tir puissant ;
  - boss qui alternent tirs et rafales.
- **Score** : les éliminations rapportent des points.
- **Combo** : enchaîner les splats augmente le multiplicateur.
- **Couverture de peinture** : chaque impact tache le sol ; la couverture verse un bonus en fin de vague.
- **Bonus ramassables** : soin, overclock, triple jet, bouclier, ricochet, bille explosive, rouleau, prime,
  dash rechargé et combo gelé.
- **Dash** : esquive rapide avec courte invulnérabilité.
- **Chargeur limité** : rechargement manuel ou automatique à zéro.
- **États complets** : accueil, partie, pause, game over, redémarrage rapide, classement local.

### 2.2 Bonus ramassables

Les capsules apparaissent après les éliminations. Les trois derniers bonus sont réservés au solo ; la table
du multijoueur reste inchangée.

| Bonus | Effet | Durée / charges |
| --- | --- | --- |
| **Soin / Peinture** | Rend 2 points de vie. | instantané |
| **Overclock** | Recharge complète + tir rapide. | 5 s |
| **Triple jet** | Trois projectiles par tir. | 9 s |
| **Bouclier de peinture** | Absorbe 2 impacts, bulle visible autour du joueur. | 10 s / 2 charges |
| **Ricochet** | Les projectiles rebondissent une fois sur les bunkers. | 8 s |
| **Bille explosive** | Le prochain tir explose en zone, endommage les groupes et peint largement. | 1 charge, max 2 |
| **Rouleau de peinture** | Le joueur peint le sol en se déplaçant. | 6 s |
| **Prime** | Ajoute `250 × vague` points au score. | instantané |
| **Dash rechargé** | Recharge le dash et ajoute un dash gratuit en réserve. | instantané |
| **Combo gelé** | Le délai du combo ne diminue plus. | 5 s |

Les bonus actifs sont lisibles dans le HUD : icône, nom, durée restante, charges.  
En multijoueur, ils apparaissent aussi sur les cartes joueurs.

### 2.3 Mobile

Le jeu détecte les écrans tactiles et bascule dans un schéma pensé pour les pouces.

| Zone | Action |
| --- | --- |
| Moitié gauche | Glisser pour se déplacer ; le pad apparaît sous le doigt. |
| Moitié droite | Glisser pour viser et tirer automatiquement en poussant à fond. |
| **FEU** | Tir maintenu avec auto-visée ; l’anneau montre le chargeur. |
| **DASH** | Esquive + i-frames ; anneau de recharge. |
| **CHG** | Rechargement manuel. |

Conception mobile :

- **Canvas plein écran** : pas de bandes noires, pas de rectangle centré.
- **Caméra multijoueur dynamique** : suit le joueur en ligne, le milieu des deux joueurs en local.
- **Mini-carte** et **flèches de hors-champ** pour garder la lecture du terrain.
- **Zones de sécurité** : encoche, barre d’accueil, coins arrondis.
- **Rotation robuste** : le canvas mesure son conteneur, pas sa propre taille précédente.
- **Plein écran** demandé au lancement quand l’API existe, sinon manifeste d’installation.
- **Haptique** : dash, impact, élimination, boss ; coupable dans le HUD.
- **Wake lock** : l’écran ne s’éteint pas pendant une partie.
- **Budget FX mobile** : particules plafonnées, DPR adapté, pas de scanlines.

### 2.4 Multijoueur

Depuis l’accueil, **MULTIJOUEUR** ouvre un écran dédié.

| Mode | Principe |
| --- | --- |
| **COOP local** | Deux joueurs, même écran, vagues partagées, pas de tir allié, réanimation. |
| **COOP en ligne** | Salon privé, code à 6 caractères, lien d’invitation, prêt / pas prêt, reconnexion. |
| **VERSUS** | 90 secondes, réapparition rapide, territoire peint, score final. |

En COOP, un joueur à terre peut être réanimé en restant près de lui.  
En VERSUS, chaque case peinte peut être volée à l’adversaire : le territoire compte dans le score final.

Le serveur en ligne est **autoritaire** : il valide les déplacements, tirs, dégâts, scores et peinture. Le client ne décide pas du résultat.

### 2.5 Progression et sauvegarde

Le jeu propose une carrière persistante :

- pseudo et couleur de peinture ;
- grade : **RECRUE → SPRAYEUR → VÉTÉRAN → LÉGENDE** ;
- record, score cumulé, meilleure vague ;
- éliminations, tirs, précision, couverture max, temps de jeu ;
- historique des dernières parties ;
- classement cloud par mode ;
- réglages son / vibration synchronisés.

Authentification Supabase :

- **invité** en un clic ;
- **email** par lien magique ;
- repli local si le cloud n’est pas configuré.

#### Sauvegarde en cours de partie

En solo :

- bouton **SAUVER** dans le HUD ;
- raccourci **Ctrl+S** ;
- **SAUVEGARDER ET QUITTER** dans la pause ;
- carte **PARTIE EN COURS** à l’accueil et dans le vestiaire.

La sauvegarde restaure :

- vague, score, combo, temps ;
- vie, munitions, bonus actifs ;
- ennemis, apparitions à venir, bonus au sol ;
- couverture et calque de peinture ;
- adaptation à un autre écran ou une autre orientation.

---

## 3. Conception

### 3.1 Identité visuelle et sonore

Le jeu cherche une sensation d’arène sportive street :

- court vert sombre, lignes chalk, bunkers bois/peinture ;
- accents cyan, magenta, lime, or, orange ;
- typographie display Bungee, texte Barlow ;
- panneaux francs, ombres dures, pas de glassmorphism généralisé ;
- peinture persistante au sol : le terrain garde la mémoire de la partie.

Le feedback est central :

- tremblements d’écran ;
- hitstop bref sur les gros impacts ;
- particules, anneaux, éclats ;
- bannières de vague et de combo ;
- sons synthétisés : tir, impact, splat, recharge, dash, bonus, boss ;
- vibrations mobiles courtes et contextuelles.

### 3.2 Architecture générale

```text
React / Tailwind
├── App.tsx                 orchestration des écrans et moteurs
├── components/             HUD, accueil, pause, game over, vestiaire, multi
├── hooks/useProgression.ts session, stats, historique, sauvegardes
└── lib/                    Supabase, scores locaux

Canvas / jeu
├── game/engine.ts          moteur solo : boucle, IA, FX, sauvegarde
├── game/multiplayer.ts     client multi : rendu, entrées, réseau, caméra
├── game/mpSim.ts           simulation pure partagée local + serveur
├── game/mpProtocol.ts      messages client / serveur
├── game/rules.ts           constantes, bonus, court, ennemis
└── game/audio.ts           SFX WebAudio

Serveur
└── server/index.ts         salons WebSocket, autorité, heartbeat

Données
└── supabase/migrations/    profils, stats, runs, saved_runs, RLS
```

### 3.3 Pourquoi Canvas plutôt que DOM ?

Le jeu manipule beaucoup d’objets mobiles : projectiles, particules, ennemis, peinture.  
Canvas 2D permet :

- un rendu maîtrisé à 60 fps ;
- des sprites de peinture mis en cache ;
- un court pré-bavé une seule fois ;
- un calque de peinture séparé ;
- des effets de caméra, shake et flash sans reflow DOM.

React reste responsable de ce qu’il fait bien : menus, HUD, formulaires, états, progression.

### 3.4 Simulation partagée

Le multijoueur ne duplique pas les règles.

- `rules.ts` contient les constantes communes.
- `mpSim.ts` est une simulation pure : joueurs, ennemis, tirs, bonus, couverture.
- Le duo local utilise cette simulation directement.
- Le serveur en ligne utilise la même simulation.
- Le client en ligne affiche, prédit et réconcilie.

Cela évite d’avoir un gameplay local qui diverge du gameplay en ligne.

### 3.5 Réseau

Modèle choisi : **serveur autoritaire + snapshots + prédiction locale**.

- Simulation serveur : **60 Hz**.
- Snapshots : **20 Hz** en partie, plus lents en salon.
- Client : prédiction du mouvement local, réconciliation à la réception des snapshots.
- Salons : code court, lien d’invitation, hôte, prêt / pas prêt.
- Reconnexion : jeton par joueur, grâce d’environ 20 secondes.
- Heartbeat : les sockets fantômes sont nettoyés.
- Limites : taille des messages, cadence d’entrées, nombre de salons / clients.

Le serveur ne fait pas confiance au client pour les dégâts, les scores ou la peinture.

### 3.6 Rendu mobile plein écran

Le problème classique des jeux canvas sur mobile est la rotation : le canvas garde une ancienne taille en pixels et laisse une zone noire.

La solution appliquée :

1. mesurer le **conteneur**, pas le canvas ;
2. garder le canvas en `width: 100%; height: 100%` ;
3. recalculer la résolution interne avec le DPR ;
4. écouter `resize`, `orientationchange`, `screen.orientation`, `visualViewport` et `ResizeObserver` ;
5. recalculer plusieurs fois après une rotation, car les navigateurs mobiles publient la taille en plusieurs temps ;
6. en multijoueur, recaler immédiatement la caméra pour couvrir l’écran.

En solo, la rotation préserve aussi la partie : positions reprojetées, couverture ré-échantillonnée, peinture conservée.

### 3.7 Données et sécurité

Supabase est utilisé pour la progression, pas pour le temps réel.

Tables principales :

| Table | Rôle |
| --- | --- |
| `profiles` | identité, couleur, réglages |
| `player_stats` | carrière agrégée |
| `runs` | parties terminées |
| `saved_runs` | partie en cours sauvegardée |

Principes :

- **RLS activée** sur les tables exposées.
- Un joueur ne lit que ses propres lignes.
- L’écriture des parties passe par `record_run()`, fonction `security definer`.
- L’identité vient du JWT, jamais d’un paramètre client.
- Les valeurs sont bornées côté SQL.
- Le classement public ne renvoie que des champs sûrs : pseudo, couleur, score, vague, couverture, grade, date.
- La clé `sb_publishable_…` est publique par design ; elle ne remplace pas les politiques RLS.
- Aucune clé `service_role` ou `sb_secret_…` ne doit être mise dans le front.

### 3.8 Performance

Choix principaux :

- court et bunkers pré-bavés dans un canvas hors écran ;
- sprites d’éclats de peinture générés une fois ;
- calque de peinture séparé ;
- couverture calculée par grille, pas par pixel ;
- particules plafonnées ;
- DPR limité sur grands écrans ;
- effets mobiles allégés ;
- build single-file pour un chargement simple.

---

## 4. Démarrage rapide

### Installer et lancer le front

```bash
npm install
npm run dev
```

Ouvre l’URL affichée par Vite, généralement <http://localhost:5173>.

### Lancer le multijoueur en local

Terminal 1 :

```bash
npx tsx server/index.ts
```

Terminal 2 :

```bash
VITE_MULTIPLAYER_URL=ws://localhost:8787 npm run dev
```

Tu peux aussi créer un fichier `.env` à partir de `.env.example`.

### Build de production

```bash
npm run build
npm run preview
```

Le build produit `dist/index.html`, autonome, avec manifeste et icône.

---

## 5. Scripts et commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | front en développement avec HMR |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert le build localement |
| `npx tsc --noEmit` | vérification du typage front |
| `npx tsc --noEmit -p server/tsconfig.json` | vérification du typage serveur |
| `npx tsx server/index.ts` | serveur de salons multijoueur |
| `./scripts/deploy.sh` | déploiement Netlify par API, sans Git |

---

## 6. Variables d’environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | front | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | front | clé publishable Supabase |
| `VITE_MULTIPLAYER_URL` | front | URL WebSocket du serveur de salons |
| `PORT` | serveur | port HTTP + WebSocket, défaut `8787` |
| `MAX_ROOMS` | serveur | salons simultanés max, défaut `200` |
| `MAX_CLIENTS` | serveur | connexions simultanées max, défaut `400` |
| `ALLOWED_ORIGIN` | serveur | origine WebSocket autorisée, optionnel |

Exemple front :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
VITE_MULTIPLAYER_URL=wss://votre-serveur.onrender.com
```

---

## 7. Déploiement

### 7.1 Front sur Netlify

Le dépôt contient `netlify.toml`.

1. **Add new site → Import an existing project**.
2. Choisir le dépôt GitHub.
3. Vérifier :
   - Build command : `npm run build`
   - Publish directory : `dist`
4. Ajouter les variables d’environnement.
5. Déployer.

Chaque push sur `main` peut relancer un build.

### 7.2 GitHub Actions

Le workflow `.github/workflows/netlify.yml` peut builder, typer et déployer.

Secrets GitHub à ajouter :

```text
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

Le workflow peut aussi publier un aperçu par PR et archiver `dist/`.

### 7.3 Serveur multijoueur

Le fichier `render.yaml` décrit un service Node :

- build : `npm ci`
- start : `npx tsx server/index.ts`
- health check : `/health`

Sur Render : **New → Blueprint**, puis choisir le dépôt.  
Ensuite, mettre l’URL publique dans `VITE_MULTIPLAYER_URL` côté Netlify, en `wss://`.

Le serveur peut aussi tourner sur Fly.io, un VPS, ou n’importe quel hébergeur Node capable de garder des WebSockets ouverts.

### 7.4 Supabase

1. Ouvrir **SQL Editor**.
2. Exécuter :
   - `supabase/migrations/202610280001_progression.sql`
   - `supabase/migrations/202610280002_saved_runs.sql`
3. Activer **Anonymous Sign-Ins** dans Authentication.
4. Configurer `Site URL` et les Redirect URLs.
5. Ajouter les variables Supabase dans Netlify.

Guide détaillé : [`supabase/README.md`](./supabase/README.md).

---

## 8. Structure du dépôt

```text
.github/workflows/        CI / déploiement Netlify
public/                   manifeste PWA, icône
scripts/                  déploiement Netlify par API
server/                   serveur de salons WebSocket
supabase/                 migrations SQL + guide
src/
├── App.tsx               point d’entrée, écrans, moteurs
├── components/           HUD, Screens, Multiplayer, Progression
├── game/                 engine, multiplayer, mpSim, rules, audio, protocol
├── hooks/                useProgression
├── lib/                  supabase, scores locaux
└── index.css             thème Tailwind, styles arcade
.env.example              variables front
netlify.toml              build, redirects, en-têtes
render.yaml               blueprint serveur
```

---

## 9. Contrôles

### Solo / clavier-souris

| Action | Commande |
| --- | --- |
| Se déplacer | WASD ou flèches |
| Viser | souris |
| Tirer | clic gauche ou Espace |
| Dash | Maj |
| Recharger | R |
| Pause | P ou Échap |
| Sauvegarder | bouton SAUVER ou Ctrl+S |
| Son | M |
| Vibration | V |
| Plein écran | F |

### Duo local

| | Joueur 1 | Joueur 2 |
| --- | --- | --- |
| Clavier | WASD + souris · Espace · Maj · R | Flèches · IJKL viser · Entrée tirer · Maj droit dash · Retour charger |
| Manette | 1ʳᵉ manette si deux sont branchées | 2ᵉ manette, ou la seule manette branchée |
| Mobile | tactile | manette conseillée ; sinon mode en ligne |

### Mobile

| Action | Commande |
| --- | --- |
| Déplacement | glisser à gauche |
| Viser / tirer | glisser à droite |
| Tir auto-visé | bouton FEU |
| Dash | bouton DASH |
| Recharger | bouton CHG |
| Pause / son / vibration | boutons du HUD |

---

## 10. Qualité et vérifications

Le projet a été vérifié sur plusieurs axes :

- typage strict front et serveur ;
- build de production ;
- boucle solo : vagues, score, bonus, game over ;
- sauvegarde / reprise avec peinture et bonus ;
- rotation mobile portrait / paysage ;
- rendu plein écran sans letterbox ;
- bonus : bouclier, ricochet, explosion, rouleau ;
- salons multijoueur : création, jonction, prêt, démarrage, reconnexion ;
- simulation COOP et VERSUS ;
- politiques Supabase RLS et fonctions d’écriture.

Les vérifications réseau et moteur ont été faites avec des scénarios headless et des clients WebSocket réels.

---

## 11. Chiffres du jeu et commandes

### Les valeurs exactes

| Élément | Valeur |
| --- | --- |
| Vie | 6 peintures · 1,15 s d'invulnérabilité après un éclat |
| Chargeur | 12 billes · recharge 0,95 s (manuelle ou auto à zéro) |
| Cadence | 0,108 s par tir · 0,062 s en OVERCLOCK |
| Dash | 0,17 s de propulsion · 1,05 s de recharge · 0,34 s d'invulnérabilité |
| Combo | x1 → x7, seuils à 2 / 4 / 7 / 11 / 16 / 22 splats enchaînés · fenêtre 3,4 s |
| Bonus de vague | 220 × vague + couverture de peinture × 1 400, et +1 PV |
| Adversaires | GRAUNT 60 PV / 120 pts · RUSHER 48 PV / 170 pts · SNIPER 52 PV / 220 pts · BOSS 420 PV / 1 600 pts |
| Vagues | 3 + 1,7 × n adversaires · boss toutes les 5 vagues |
| Drops | 24 % à la mort d'un adversaire · 100 % premium sur un boss |
| Ramassages | OVERCLOCK (5 s) · TRIPLE STREAM (9 s) · +PAINT (2 PV) · BOUCLIER (2 éclats) · RICOCHET (3 rebonds, 12 s) · BILLE EXPLOSIVE (zone, 9 s) · ROULEAU (instantané) |

### Les commandes

| Clavier | Action | Tactile |
| --- | --- | --- |
| `W A S D` / flèches | Se déplacer | Glisser sur la moitié gauche |
| Souris | Viser | Glisser sur la moitié droite (tir automatique) |
| `Clic` / `Espace` | Arroser | — |
| `Maj` | Dash + invulnérabilité | Pad **DASH** |
| `R` | Recharger | Pad **CHARGE** |
| `P` / `Échap` | Pause | Bouton pause |
| `M` / `V` / `F` | Son / vibration / plein écran | Boutons dédiés |

En **duo local**, le pilote 2 joue aux flèches, tire avec `Entrée`, dash avec `Maj droit` et recharge avec `.`.

### Ce que stocke la base

Les migrations [`supabase/migrations/`](./supabase/migrations) créent notamment :

| `player_stats` | — |
| `profiles` | — |
| `runs` | — |
| `saved_runs` | — |

Les écritures passent par des fonctions SQL (une partie terminée dépose la ligne **et** met à jour la
progression en une seule requête), et les politiques **RLS** garantissent que chacun n'écrit que ses
propres lignes — les classements restent publics, un score déposé ne peut plus être modifié.

---

## 12. Pistes d’évolution

Quelques suites naturelles :

- classement mondial signé côté serveur ;
- matchmaking simple ;
- replays / killcams ;
- skins de marqueur et traînées ;
- cartes supplémentaires ;
- mode entraînement ;
- tutoriel interactif ;
- statistiques avancées par arme / bonus ;
- support manette dans les menus ;
- export / import de sauvegarde.

---

## 13. Auteur

Projet développé par **loba225samuel-coder**.  
Dépôt : <https://github.com/loba225samuel-coder/painballv2>
