# Serveur de salons — PAINTBALL 2D

Petit serveur Node.js + `ws`, **autoritaire** : il simule la partie, valide les entrées et diffuse des snapshots.
Aucune base de données : les salons vivent en mémoire et disparaissent quand ils sont vides.

## Démarrer en local

```bash
npm install
npx tsx server/index.ts
# → salons WebSocket sur ws://localhost:8787
# → santé : http://localhost:8787/health
```

Puis, dans un autre terminal :

```bash
VITE_MULTIPLAYER_URL=ws://localhost:8787 npm run dev
```

Ouvrez deux navigateurs (ou deux appareils sur le même réseau), créez un salon dans l’un, rejoignez avec le code dans l’autre.

## Déployer

### Render (blueprint fourni)

Le fichier `render.yaml` à la racine décrit le service :

- build : `npm ci`
- start : `npx tsx server/index.ts`
- health check : `/health`

Sur Render : **New → Blueprint**, choisissez le dépôt, puis déployez.
Copiez l’URL publique (ex. `https://paintball-2d-server.onrender.com`) et ajoutez côté Netlify :

```
VITE_MULTIPLAYER_URL=wss://paintball-2d-server.onrender.com
```

> Le plan gratuit Render s’endort après inactivité : le premier salon peut mettre ~30 s à démarrer.

### Fly.io / autre VPS

Même commande de démarrage. Exemple Fly :

```bash
fly launch --no-deploy
fly secrets set ALLOWED_ORIGIN=https://votre-site.netlify.app
fly deploy
```

## Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8787` | Port HTTP + WebSocket |
| `MAX_ROOMS` | `200` | Salons simultanés maximum |
| `MAX_CLIENTS` | `400` | Connexions simultanées maximum |
| `ALLOWED_ORIGIN` | *(vide)* | Si renseigné, refuse les autres origines WebSocket |

## Protocole

- Client → serveur : `create`, `join`, `rejoin`, `ready`, `start`, `input`, `ping`, `leave`.
- Serveur → client : `welcome`, `room`, `snapshot`, `pong`, `error`.
- Simulation : **60 Hz** côté serveur, snapshots **20 Hz** en jeu (5 Hz en salon).
- Reconnexion : un jeton par joueur, grâce de **20 s** avant libération de la place.
- Anti-abus : taille de message limitée, nom assaini, cadence d’entrées plafonnée, scores/dégâts calculés uniquement par le serveur.

## Structure

```
server/index.ts        salons, WebSocket, boucle 60 Hz, heartbeat
src/game/mpSim.ts      simulation pure partagée avec le client local
src/game/mpProtocol.ts messages client/serveur
src/game/rules.ts      constantes de jeu communes
```
