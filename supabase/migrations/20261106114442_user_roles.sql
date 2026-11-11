-- ---------------------------------------------------------------------------
-- Role użytkowników: moderator i administrator.
--
-- Rola jest trzymana w tabeli, nie w tokenie JWT. Powód: odebranie uprawnień musi
-- działać natychmiast, a rola zapisana w tokenie obowiązywałaby do jego wygaśnięcia.
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Role przypisane użytkownikom. Brak wiersza = zwykły użytkownik.';

-- security definer jest tu konieczny: polityka RLS na user_roles woła tę funkcję,
-- więc bez pominięcia RLS powstałaby nieskończona rekurencja polityk.
-- set search_path = '' wymusza kwalifikowane nazwy — ten sam wzorzec co handle_new_user().
-- Administrator spełnia każdą rolę, dzięki czemu polityki nie muszą wymieniać obu.
create function public.has_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in (target_role, 'admin')
  );
$$;

revoke execute on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

alter table public.user_roles enable row level security;

create policy "Role: odczyt własnych" on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_role('admin'));

create policy "Role: nadawanie przez administratora" on public.user_roles
  for insert to authenticated
  with check (public.has_role('admin') and (select auth.uid()) = granted_by);

create policy "Role: odbieranie przez administratora" on public.user_roles
  for delete to authenticated
  using (public.has_role('admin'));

-- Brak polityki UPDATE celowo: zmiana roli to usunięcie i nadanie, więc nie ma
-- stanu „rola w trakcie zmiany".

-- ---------------------------------------------------------------------------
-- Brakująca polityka INSERT na profiles.
-- Dotąd wiersz profilu tworzył wyłącznie trigger on_auth_user_created. Jeśli trigger
-- zawiódł, getProfile rzucał i aplikacja nie miała z czego się podnieść.
-- ---------------------------------------------------------------------------
create policy "Profil: utworzenie własnego" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

