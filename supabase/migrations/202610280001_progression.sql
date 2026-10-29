-- ============================================================================
-- PAINTBALL 2D — Sauvegarde de progression
-- À exécuter dans Supabase → SQL Editor (ou `supabase db push`).
-- Idempotent : peut être rejoué sans casser les données existantes.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'JOUEUR',
  paint_color  text not null default '#3ee8ff',
  settings     jsonb not null default '{}'::jsonb,
  progress     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_name_len check (char_length(display_name) between 1 and 16),
  constraint profiles_color_hex check (paint_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint profiles_settings_size check (char_length(settings::text) <= 8000),
  constraint profiles_progress_size check (char_length(progress::text) <= 8000)
);

create table if not exists public.player_stats (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  games_played integer not null default 0,
  total_score  bigint  not null default 0,
  best_score   integer not null default 0,
  best_wave    integer not null default 0,
  total_kills  integer not null default 0,
  total_shots  integer not null default 0,
  total_hits   integer not null default 0,
  best_coverage real   not null default 0,
  total_time   real    not null default 0,
  coop_games   integer not null default 0,
  versus_games integer not null default 0,
  versus_wins  integer not null default 0,
  updated_at   timestamptz not null default now()
);

create table if not exists public.runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mode       text not null check (mode in ('solo', 'coop', 'versus')),
  score      integer not null default 0 check (score between 0 and 10000000),
  wave       integer not null default 0 check (wave between 0 and 1000),
  kills      integer not null default 0 check (kills >= 0),
  shots      integer not null default 0 check (shots >= 0),
  hits       integer not null default 0 check (hits >= 0),
  max_combo  integer not null default 0 check (max_combo >= 0),
  coverage   real    not null default 0 check (coverage between 0 and 1),
  duration   real    not null default 0 check (duration >= 0),
  won        boolean,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint runs_details_size check (char_length(details::text) <= 8000)
);

create index if not exists runs_user_created_idx on public.runs (user_id, created_at desc);
create index if not exists runs_mode_score_idx   on public.runs (mode, score desc, created_at asc);
create index if not exists runs_score_idx        on public.runs (score desc);

-- ----------------------------------------------------------------------------
-- 2. Déclencheurs : profil + stats à la création du compte, updated_at
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      'JOUEUR-' || upper(substr(new.id::text, 1, 4))
    )
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists player_stats_touch on public.player_stats;
create trigger player_stats_touch
  before update on public.player_stats
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Grade du joueur ( cosmetics / progression visible )
-- ----------------------------------------------------------------------------

create or replace function public.player_grade(p_total_score bigint, p_best_wave integer)
returns text
language sql
immutable
as $$
  select case
    when p_best_wave >= 20 or p_total_score >= 500000 then 'LÉGENDE'
    when p_best_wave >= 10 or p_total_score >= 150000 then 'VÉTÉRAN'
    when p_best_wave >= 5  or p_total_score >= 40000  then 'SPRAYEUR'
    else 'RECRUE'
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Enregistrer une partie (atomique : run + stats)
--    Security definer : le client ne peut pas écrire directement dans stats.
--    L'identité vient du JWT, jamais d'un paramètre client.
-- ----------------------------------------------------------------------------

create or replace function public.record_run(
  p_mode      text,
  p_score     integer,
  p_wave      integer default 0,
  p_kills     integer default 0,
  p_shots     integer default 0,
  p_hits      integer default 0,
  p_max_combo integer default 0,
  p_coverage  real    default 0,
  p_duration  real    default 0,
  p_won       boolean default null,
  p_details   jsonb   default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_score integer := greatest(0, least(coalesce(p_score, 0), 10000000));
  v_wave  integer := greatest(0, least(coalesce(p_wave, 0), 1000));
  v_cov   real    := greatest(0, least(coalesce(p_coverage, 0), 1));
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  if p_mode not in ('solo', 'coop', 'versus') then
    raise exception 'Mode invalide';
  end if;

  insert into public.runs (
    user_id, mode, score, wave, kills, shots, hits, max_combo, coverage, duration, won, details
  ) values (
    v_uid, p_mode, v_score, v_wave,
    greatest(0, coalesce(p_kills, 0)),
    greatest(0, coalesce(p_shots, 0)),
    greatest(0, coalesce(p_hits, 0)),
    greatest(0, coalesce(p_max_combo, 0)),
    v_cov,
    greatest(0, coalesce(p_duration, 0)),
    p_won,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  insert into public.player_stats as s (
    user_id, games_played, total_score, best_score, best_wave,
    total_kills, total_shots, total_hits, best_coverage, total_time,
    coop_games, versus_games, versus_wins
  ) values (
    v_uid, 1, v_score, v_score, v_wave,
    greatest(0, coalesce(p_kills, 0)),
    greatest(0, coalesce(p_shots, 0)),
    greatest(0, coalesce(p_hits, 0)),
    v_cov,
    greatest(0, coalesce(p_duration, 0)),
    case when p_mode = 'coop' then 1 else 0 end,
    case when p_mode = 'versus' then 1 else 0 end,
    case when p_mode = 'versus' and p_won then 1 else 0 end
  )
  on conflict (user_id) do update set
    games_played  = s.games_played + 1,
    total_score   = s.total_score + v_score,
    best_score    = greatest(s.best_score, v_score),
    best_wave     = greatest(s.best_wave, v_wave),
    total_kills   = s.total_kills + greatest(0, coalesce(p_kills, 0)),
    total_shots   = s.total_shots + greatest(0, coalesce(p_shots, 0)),
    total_hits    = s.total_hits + greatest(0, coalesce(p_hits, 0)),
    best_coverage = greatest(s.best_coverage, v_cov),
    total_time    = s.total_time + greatest(0, coalesce(p_duration, 0)),
    coop_games    = s.coop_games + case when p_mode = 'coop' then 1 else 0 end,
    versus_games  = s.versus_games + case when p_mode = 'versus' then 1 else 0 end,
    versus_wins   = s.versus_wins + case when p_mode = 'versus' and p_won then 1 else 0 end;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Classement public : ne renvoie que des champs sûrs (pas d'uuid, pas d'email)
-- ----------------------------------------------------------------------------

create or replace function public.leaderboard(
  p_mode  text default 'solo',
  p_limit integer default 10
)
returns table (
  display_name text,
  paint_color  text,
  score        integer,
  wave         integer,
  coverage     real,
  grade        text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    p.paint_color,
    r.score,
    r.wave,
    r.coverage,
    public.player_grade(s.total_score, s.best_wave),
    r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  left join public.player_stats s on s.user_id = r.user_id
  where r.mode = p_mode
  order by r.score desc, r.created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS + grants minimaux
-- ----------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.player_stats enable row level security;
alter table public.runs        enable row level security;

revoke all on table public.profiles     from anon, authenticated;
revoke all on table public.player_stats from anon, authenticated;
revoke all on table public.runs         from anon, authenticated;

grant select, insert, update on table public.profiles     to authenticated;
grant select                 on table public.player_stats to authenticated;
grant select                 on table public.runs         to authenticated;
grant all                    on table public.profiles     to service_role;
grant all                    on table public.player_stats to service_role;
grant all                    on table public.runs         to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists stats_select_own on public.player_stats;
create policy stats_select_own on public.player_stats
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists runs_select_own on public.runs;
create policy runs_select_own on public.runs
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Pas de politique insert/update/delete sur runs et stats :
-- seul record_run (security definer) peut écrire, et uniquement pour auth.uid().

revoke all on function public.record_run(text, integer, integer, integer, integer, integer, integer, real, real, boolean, jsonb) from public;
grant execute on function public.record_run(text, integer, integer, integer, integer, integer, integer, real, real, boolean, jsonb) to authenticated;

revoke all on function public.leaderboard(text, integer) from public;
grant execute on function public.leaderboard(text, integer) to anon, authenticated;

revoke all on function public.player_grade(bigint, integer) from public;
grant execute on function public.player_grade(bigint, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Rattrapage : comptes déjà créés avant cette migration
-- ----------------------------------------------------------------------------

insert into public.profiles (id, display_name)
select u.id, 'JOUEUR-' || upper(substr(u.id::text, 1, 4))
from auth.users u
on conflict (id) do nothing;

insert into public.player_stats (user_id)
select id from public.profiles
on conflict (user_id) do nothing;
