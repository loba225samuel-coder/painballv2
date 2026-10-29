-- ============================================================================
-- PAINTBALL 2D — Sauvegarde d'une partie en cours (reprendre plus tard)
-- À exécuter après 202610280001_progression.sql.
-- Une sauvegarde active par joueur et par mode (solo pour l'instant).
-- ============================================================================

create table if not exists public.saved_runs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mode       text not null default 'solo' check (mode in ('solo', 'coop', 'versus')),
  -- état du jeu sans l'image de peinture (vague, score, ennemis, couverture…)
  state      jsonb not null,
  -- calque de peinture encodé (data URL), séparé pour garder state léger
  paint      text,
  wave       integer not null default 0 check (wave between 0 and 1000),
  score      integer not null default 0 check (score between 0 and 10000000),
  label      text not null default '',
  saved_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode),
  constraint saved_state_size check (char_length(state::text) <= 1500000),
  constraint saved_paint_size check (paint is null or char_length(paint) <= 2000000),
  constraint saved_label_len check (char_length(label) <= 80)
);

drop trigger if exists saved_runs_touch on public.saved_runs;
create trigger saved_runs_touch
  before update on public.saved_runs
  for each row execute function public.touch_updated_at();

alter table public.saved_runs enable row level security;

revoke all on table public.saved_runs from anon, authenticated;
grant select, insert, update, delete on table public.saved_runs to authenticated;
grant all on table public.saved_runs to service_role;

drop policy if exists saved_runs_select_own on public.saved_runs;
create policy saved_runs_select_own on public.saved_runs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists saved_runs_insert_own on public.saved_runs;
create policy saved_runs_insert_own on public.saved_runs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists saved_runs_update_own on public.saved_runs;
create policy saved_runs_update_own on public.saved_runs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists saved_runs_delete_own on public.saved_runs;
create policy saved_runs_delete_own on public.saved_runs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.saved_runs is
  'Partie en cours sauvegardée manuellement. Reprendre plus tard, même sur un autre appareil.';
