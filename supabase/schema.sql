-- ---------------------------------------------------------------------------
-- 8. SAUVEGARDE DE PARTIE — une seule par joueur (« revenir plus tard »)
--    Le joueur arrive vague 5, il appuie sur SAUVEGARDER & QUITTER : la partie
--    complète (score, pilotes, ennemis, peinture du terrain) part ici.
-- ---------------------------------------------------------------------------
create table if not exists public.saves (
  player_id  uuid primary key references auth.users (id) on delete cascade,
  label      text        not null default '',
  wave       integer     not null default 0,
  score      integer     not null default 0,
  payload    jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "lire sa sauvegarde"      on public.saves;
drop policy if exists "poser sa sauvegarde"      on public.saves;
drop policy if exists "modifier sa sauvegarde"   on public.saves;
drop policy if exists "supprimer sa sauvegarde"  on public.saves;

create policy "lire sa sauvegarde" on public.saves
  for select using (auth.uid() = player_id);

create policy "poser sa sauvegarde" on public.saves
  for insert with check (auth.uid() = player_id);

create policy "modifier sa sauvegarde" on public.saves
  for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

create policy "supprimer sa sauvegarde" on public.saves
  for delete using (auth.uid() = player_id);

-- Sauvegarde privée : personne ne peut lire celle d'un autre joueur.

-- ---------------------------------------------------------------------------
-- 9. ENTRETIEN — pourquoi la base se remplit, et comment la tenir propre
--
-- a) `profiles` se remplit TOUT SEUL par design : le trigger `on_auth_user_created`
--    crée une ligne pour chaque compte (y compris anonyme). Un joueur = un
--    compte anonyme par navigateur : visiteur curieux, appareil de test, session
--    perdue (navigation privée, stockage effacé) => nouvelle ligne.
--    Une ligne avec total_runs = 0 n'a jamais terminé de partie.
--
-- b) `players` : table que ce projet n'écrit JAMAIS. Si elle existe dans ton
--    projet, elle vient d'ailleurs (essai manuel, template, autre appli).
--    Pour voir ce qu'elle contient :   select * from public.players limit 20;
--    Pour la supprimer si elle ne sert à rien : drop table public.players;
--
-- c) Purge des visiteurs sans partie (les scores restent intacts) :
--      delete from public.profiles
--       where total_runs = 0
--         and last_seen < now() - interval '30 days';
--
-- d) Comptes anonymes orphelins (purge douce, à faire de temps en temps) :
--      delete from auth.users au
--       where au.is_anonymous = true
--         and not exists (select 1 from public.runs r where r.player_id = au.id)
--         and au.created_at < now() - interval '30 days';
--
-- e) Qui a écrit quoi :
--      select p.name, p.total_runs, p.best_score, p.last_seen, count(r.id) as parties
--        from public.profiles p left join public.runs r on r.player_id = p.id
--       group by p.id order by p.last_seen desc limit 20;
-- ===========================================================================
-- PAINTBALL 2D — base de données de progression (Supabase / PostgreSQL)
--
-- À coller dans : Supabase → SQL Editor → New query → Run.
-- Ça crée : profils, historique des parties, classement mondial, RPC de
-- soumission, et la sécurité (RLS) qui va avec.
--
-- Le jeu fonctionne SANS base (repli localStorage) : cette base ajoute la
-- progression enregistrée et le classement mondial.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILS — la progression agrégée d'un joueur
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text        not null default 'ACE' check (char_length(name) between 1 and 12),
  best_score    integer     not null default 0 check (best_score >= 0),
  best_wave     integer     not null default 0 check (best_wave >= 0),
  total_runs    integer     not null default 0 check (total_runs >= 0),
  total_kills   integer     not null default 0 check (total_kills >= 0),
  -- couverture de peinture cumulée (0..1 par partie, sommée)
  total_paint   numeric     not null default 0,
  total_seconds integer     not null default 0 check (total_seconds >= 0),
  -- réservé : cosmétiques / déblocages à venir (mode versus, marqueurs…)
  meta          jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. PARTIES — chaque run terminée, intouchable ensuite (anti-triche douce)
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  player_id  uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null default 'ACE',
  score      integer     not null check (score >= 0),
  wave       integer     not null check (wave >= 0),
  kills      integer     not null default 0 check (kills >= 0),
  kills2     integer     not null default 0 check (kills2 >= 0),
  accuracy   integer     not null default 0 check (accuracy between 0 and 100),
  coverage   integer     not null default 0 check (coverage between 0 and 100),
  duration   integer     not null default 0 check (duration >= 0),
  duo        boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists runs_score_idx    on public.runs (score desc);
create index if not exists runs_player_idx   on public.runs (player_id, created_at desc);
create index if not exists runs_wave_idx     on public.runs (wave desc, score desc);

-- ---------------------------------------------------------------------------
-- 3. VUE — classement mondial (top 50), lisible par tout le monde
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard as
  select name, score, wave, kills, coverage, duo, created_at
  from public.runs
  order by score desc, wave desc, created_at asc
  limit 50;

-- ---------------------------------------------------------------------------
-- 4. SÉCURITÉ (RLS)
--    - chacun écrit uniquement SES lignes
--    - les classements sont publics
--    - aucune modification des parties déjà déposées
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.runs     enable row level security;

drop policy if exists "profil lisible par tous"  on public.profiles;
drop policy if exists "créer son profil"         on public.profiles;
drop policy if exists "modifier son profil"      on public.profiles;
drop policy if exists "parties lisibles"         on public.runs;
drop policy if exists "déposer sa partie"        on public.runs;

create policy "profil lisible par tous" on public.profiles
  for select using (true);

create policy "créer son profil" on public.profiles
  for insert with check (auth.uid() = id);

create policy "modifier son profil" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "parties lisibles" on public.runs
  for select using (true);

create policy "déposer sa partie" on public.runs
  for insert with check (auth.uid() = player_id);

-- pas de policy update/delete sur runs : les scores déjà déposés sont figés.

-- ---------------------------------------------------------------------------
-- 5. PROFIL AUTOMATIQUE — tout nouveau compte (y compris anonyme) a un profil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. RPC — déposer une partie ET mettre à jour la progression, en une passe
--    (une seule requête réseau du point de vue du jeu)
-- ---------------------------------------------------------------------------
create or replace function public.submit_run(
  p_name      text,
  p_score     integer,
  p_wave      integer,
  p_kills     integer,
  p_coverage  integer,
  p_duration  integer,
  p_duo       boolean,
  p_kills2    integer default 0,
  p_accuracy  integer default 0
)
returns public.runs
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.runs;
begin
  if v_uid is null then
    raise exception 'non authentifié';
  end if;

  insert into public.profiles (id, name)
  values (v_uid, left(coalesce(p_name, 'ACE'), 12))
  on conflict (id) do nothing;

  insert into public.runs (player_id, name, score, wave, kills, kills2, accuracy, coverage, duration, duo)
  values (v_uid, left(coalesce(p_name, 'ACE'), 12), p_score, p_wave, p_kills, p_kills2, p_accuracy, p_coverage, p_duration, p_duo)
  returning * into v_run;

  update public.profiles
     set name        = left(coalesce(p_name, name), 12),
         best_score  = greatest(best_score, p_score),
         best_wave   = greatest(best_wave, p_wave),
         total_runs  = total_runs + 1,
         total_kills = total_kills + p_kills + p_kills2,
         total_paint = total_paint + (p_coverage::numeric / 100),
         total_seconds = total_seconds + p_duration,
         last_seen   = now()
   where id = v_uid;

  return v_run;
end;
$$;

-- Seul un utilisateur connecté peut appeler la RPC (elle vérifie auth.uid()).
revoke all on function public.submit_run(text, integer, integer, integer, integer, integer, boolean, integer, integer) from public;
grant execute on function public.submit_run(text, integer, integer, integer, integer, integer, boolean, integer, integer) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 7. NETTOYAGE FACULTATIF — purger les très vieilles parties
--    select cron.schedule('purge-runs', '0 4 * * 0', $$ delete from public.runs where created_at < now() - interval '12 months' $$);
-- ===========================================================================
