-- ============================================================================
-- PAINTBALL 2D — Noms de profil fiables
-- Objectif :
--   1. ne plus générer de pseudo par défaut "JOUEUR-****" ;
--   2. permettre au client d'écrire son nom même si la ligne profil manque ;
--   3. réparer les profils par défaut quand un nom existe dans les métadonnées.
-- À exécuter après 202610280001_progression.sql et 202610280002_saved_runs.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Création de compte : utiliser le nom fourni, sinon "JOUEUR"
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'JOUEUR'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(v_name, 16))
  on conflict (id) do nothing;

  insert into public.player_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Écriture du nom : fonction sûre, idempotente, liée au JWT
-- ----------------------------------------------------------------------------

create or replace function public.set_profile_name(p_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_row  public.profiles;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  v_name := left(btrim(coalesce(p_name, '')), 16);
  if v_name = '' then
    v_name := 'JOUEUR';
  end if;

  insert into public.profiles as p (id, display_name, settings)
  values (v_uid, v_name, jsonb_build_object('name', v_name))
  on conflict (id) do update
    set display_name = excluded.display_name,
        settings = jsonb_set(
          coalesce(p.settings, '{}'::jsonb),
          '{name}',
          to_jsonb(v_name),
          true
        ),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_profile_name(text) from public;
grant execute on function public.set_profile_name(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Rattrapage : profils par défaut existants
-- ----------------------------------------------------------------------------

-- Si un nom a été fourni dans les métadonnées Auth, on l'applique.
update public.profiles p
set display_name = left(
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    p.display_name
  ),
  16
)
from auth.users u
where p.id = u.id
  and p.display_name ~ '^JOUEUR-'
  and coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    ''
  ) <> '';

-- Les anciens pseudos techniques "JOUEUR-AB12" redeviennent simplement "JOUEUR".
update public.profiles
set display_name = 'JOUEUR'
where display_name ~ '^JOUEUR-[0-9A-Fa-f]{4}$';

comment on function public.set_profile_name(text) is
  'Écrit le pseudo du joueur connecté. Crée le profil si nécessaire. Ne prend jamais un user_id client.';
