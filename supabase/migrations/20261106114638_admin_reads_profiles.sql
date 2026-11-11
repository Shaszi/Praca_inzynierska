-- ---------------------------------------------------------------------------
-- Panel administratora musi wylistować użytkowników, żeby nadać im role.
-- Udostępniamy wyłącznie tabelę profiles (nazwa i ustawienia celu), nigdy auth.users —
-- adresy e-mail zostają poza zasięgiem klienta.
-- ---------------------------------------------------------------------------
create policy "Profil: odczyt wszystkich przez administratora" on public.profiles
  for select to authenticated
  using (public.has_role('admin'));
