# Base de données — PAINTBALL 2D

Projet Supabase : `https://ipdohwwyletjrkdrlyma.supabase.co`

La clé fournie est une **clé publishable** (`sb_publishable_…`) : elle est faite pour être dans le front.
La sécurité vient des **politiques RLS** et des fonctions `security definer`, pas du secret de la clé.
Ne jamais mettre une clé `sb_secret_…` ou `service_role` dans le client.

## Ce que la base sauvegarde

- `profiles` : pseudo, couleur de peinture, réglages (son, vibration), progression légère (tutoriels vus, dernier mode).
- `player_stats` : parties jouées, score cumulé, record, meilleure vague, éliminations, tirs, précision, couverture, temps, coop/versus, victoires.
- `runs` : chaque partie terminée (solo, coop, versus), avec score, vague, stats, durée, victoire et détails.
- `saved_runs` : une partie **en cours** par joueur/mode, pour sauvegarder à la vague 5 et reprendre plus tard.
- `leaderboard(mode, limit)` : classement public par mode, sans exposer les identifiants.
- `player_grade(total_score, best_wave)` : RECRUE → SPRAYEUR → VÉTÉRAN → LÉGENDE.

## Installation (2 minutes)

1. Ouvrez le projet Supabase → **SQL Editor**.
2. Collez le contenu de [`migrations/202610280001_progression.sql`](./migrations/202610280001_progression.sql), puis **Run**.
3. Collez ensuite [`migrations/202610280002_saved_runs.sql`](./migrations/202610280002_saved_runs.sql), puis **Run**.
4. **Authentication → Providers** :
   - activez **Anonymous Sign-Ins** (sauvegarde invité en un clic) ;
   - laissez **Email** activé si vous voulez les comptes par lien magique.
5. **Authentication → URL Configuration** :
   - `Site URL` : votre URL Netlify, par ex. `https://votre-site.netlify.app` ;
   - `Redirect URLs` : ajoutez aussi `http://localhost:5173/**` pour le dev.
6. Côté front, les variables sont déjà prêtes dans `.env.example` :
   ```
   VITE_SUPABASE_URL=https://ipdohwwyletjrkdrlyma.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_…
   ```
   Sur Netlify : **Site configuration → Environment variables**, puis redéployez.

Avec la CLI Supabase :

```bash
supabase link --project-ref ipdohwwyletjrkdrlyma
supabase db push
```

## Modèle de sécurité

- RLS activée sur `profiles`, `player_stats`, `runs`.
- Un joueur ne lit que **ses** lignes (`auth.uid()`).
- Les écritures de parties/stats passent uniquement par `record_run()` :
  - fonction `security definer` ;
  - l’utilisateur vient du JWT, jamais d’un paramètre ;
  - bornes SQL sur score, vague, couverture, taille des JSON.
- `leaderboard()` ne renvoie que pseudo, couleur, score, vague, couverture, grade, date.
- Les comptes invités sont de vrais utilisateurs Supabase (`authenticated`), mais sans email :
  la sauvegarde suit le navigateur. Un compte email permet de retrouver la progression ailleurs.

## Vérifier rapidement

Dans SQL Editor :

```sql
select public.player_grade(0, 0);          -- RECRUE
select * from public.leaderboard('solo');  -- vide au début
```

Dans l’application :

1. Accueil → **PROGRESSION** → **Continuer en invité**.
2. Jouez une partie solo : elle apparaît dans l’historique et les stats se mettent à jour.
3. Rechargez la page : la progression est toujours là.
4. En partie, bouton **SAUVER** (ou `Ctrl+S`) → accueil → **REPRENDRE** : la vague, le score, les ennemis et la peinture sont restaurés.

## Notes

- Le multijoueur en ligne reste sur le serveur de salons (`server/`). La base sauvegarde le **résultat** côté joueur ; elle ne remplace pas le serveur temps réel.
- Les records locaux (`localStorage`) restent disponibles comme secours hors ligne.
- La sauvegarde en cours est aussi écrite localement (`pb2d.save.solo`) ; si le cloud est connecté, elle est synchronisée dans `saved_runs`. Le calque de peinture est stocké à part, en image réduite, pour garder l’état JSON léger.
- Pour réinitialiser un compte de test : supprimez l’utilisateur dans Authentication, les lignes liées partent en cascade.
