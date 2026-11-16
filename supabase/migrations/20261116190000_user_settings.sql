-- Ustawienia aplikacji przypisane do konta, żeby szły za użytkownikiem między urządzeniami.
-- Osobna tabela, a nie kolumna w profiles: profil czytają też inni (nazwa autora wzorca,
-- administrator), a ustawień nie powinien widzieć nikt poza właścicielem.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Ustawienia: odczyt własnych" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Ustawienia: dodanie własnych" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Ustawienia: edycja własnych" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon;
