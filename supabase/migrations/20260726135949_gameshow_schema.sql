-- RÉCUPÉRÉE depuis l'historique de la base (finding F-006).
--
-- Cette migration avait bel et bien été APPLIQUÉE le 2026-07-26 — elle figure
-- dans `supabase_migrations.schema_migrations` sous la version 20260726135949 —
-- mais son fichier n'avait jamais été versionné : `supabase/migrations/` était
-- vide côté dépôt. Le schéma était donc reproductible depuis Supabase, et
-- seulement depuis Supabase. C'est ce que l'audit signalait comme bloquant.
--
-- Le SQL ci-dessous est celui qui a réellement été exécuté, repris à l'identique.
-- Rien n'y a été ajouté ni retiré : le dépôt décrit désormais exactement l'état
-- de la base, et non une reconstitution de mémoire.

-- Project Game Show — schéma : profils animateurs + modules (questions imbriquées).

-- Profils (1 par animateur = auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Création auto du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Modules (mini-jeux de l'animateur), questions imbriquées en jsonb
create table if not exists public.modules (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  name text not null default 'Module',
  duration integer not null default 20,
  color text default 'fire',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.modules enable row level security;
create index if not exists modules_owner_idx on public.modules(owner_id);
create index if not exists modules_owner_type_idx on public.modules(owner_id, type);

drop policy if exists modules_select_own on public.modules;
create policy modules_select_own on public.modules for select using (auth.uid() = owner_id);
drop policy if exists modules_insert_own on public.modules;
create policy modules_insert_own on public.modules for insert with check (auth.uid() = owner_id);
drop policy if exists modules_update_own on public.modules;
create policy modules_update_own on public.modules for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists modules_delete_own on public.modules;
create policy modules_delete_own on public.modules for delete using (auth.uid() = owner_id);
