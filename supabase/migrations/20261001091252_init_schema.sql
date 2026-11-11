-- Schemat bazy aplikacji Drawing Trainer.
-- Każda tabela jest chroniona przez Row Level Security: użytkownik widzi i modyfikuje wyłącznie własne dane.

-- ---------------------------------------------------------------------------
-- Profile użytkowników (1:1 z auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  -- Cel nauki: liczba dni, w których użytkownik chce ukończyć co najmniej jeden rysunek.
  goal_days integer check (goal_days between 1 and 365),
  goal_started_on date,
  -- Strefa czasowa decyduje, do którego dnia zalicza się ukończony rysunek.
  timezone text not null default 'Europe/Warsaw',
  -- Ustawienia rysowania (wygładzanie, rozmiar pędzla) synchronizowane między urządzeniami.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_complete check ((goal_days is null) = (goal_started_on is null))
);

-- ---------------------------------------------------------------------------
-- Wzorce rysunków tworzone w edytorze
-- ---------------------------------------------------------------------------
create table public.drawing_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  strokes jsonb not null check (jsonb_typeof(strokes) = 'array'),
  created_at timestamptz not null default now()
);

create index drawing_references_user_created_idx
  on public.drawing_references (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sesje ćwiczeń: jedna sesja = jeden rysunek (wg wzorca albo wg zdjęcia)
-- ---------------------------------------------------------------------------
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('reference', 'image')),
  reference_id uuid references public.drawing_references (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  steps_total integer not null check (steps_total > 0),
  steps_completed integer not null default 0 check (steps_completed >= 0),
  -- Średnia ocena podobieństwa (0–100); tylko dla trybu wzorca, gdzie liczymy ją algorytmicznie.
  average_score numeric(5, 2) check (average_score between 0 and 100),
  -- Końcowy rysunek użytkownika, pozwala pokazać miniaturę w historii.
  final_strokes jsonb check (final_strokes is null or jsonb_typeof(final_strokes) = 'array'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint steps_in_range check (steps_completed <= steps_total)
);

create index practice_sessions_user_completed_idx
  on public.practice_sessions (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Pojedyncze próby (kreski) w ramach sesji, wraz z oceną i feedbackiem AI
-- ---------------------------------------------------------------------------
create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  stroke jsonb not null check (jsonb_typeof(stroke) = 'object'),
  score numeric(5, 2) check (score between 0 and 100),
  ai_feedback text,
  created_at timestamptz not null default now()
);

create index practice_attempts_session_idx on public.practice_attempts (session_id, step_index);

-- ---------------------------------------------------------------------------
-- Aktywność dzienna: liczba ukończonych rysunków na dzień w strefie czasowej użytkownika.
-- security_invoker sprawia, że widok respektuje RLS tabel bazowych.
-- ---------------------------------------------------------------------------
create view public.daily_activity
with (security_invoker = true) as
select
  s.user_id,
  (s.completed_at at time zone p.timezone)::date as day,
  count(*)::integer as completed_count
from public.practice_sessions s
join public.profiles p on p.id = s.user_id
where s.completed_at is not null
group by s.user_id, (s.completed_at at time zone p.timezone)::date;

-- ---------------------------------------------------------------------------
-- Triggery
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatyczne tworzenie profilu po rejestracji (email lub Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.drawing_references enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_attempts enable row level security;

create policy "Profil: odczyt własnego" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Profil: edycja własnego" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Wzorce: odczyt własnych" on public.drawing_references
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Wzorce: dodawanie własnych" on public.drawing_references
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Wzorce: edycja własnych" on public.drawing_references
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Wzorce: usuwanie własnych" on public.drawing_references
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Sesje: odczyt własnych" on public.practice_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Sesje: dodawanie własnych" on public.practice_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      reference_id is null
      or exists (
        select 1 from public.drawing_references r
        where r.id = reference_id and r.user_id = (select auth.uid())
      )
    )
  );
create policy "Sesje: edycja własnych" on public.practice_sessions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Sesje: usuwanie własnych" on public.practice_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Próby: odczyt własnych" on public.practice_attempts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Próby: dodawanie do własnych sesji" on public.practice_attempts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy "Próby: usuwanie własnych" on public.practice_attempts
  for delete to authenticated using ((select auth.uid()) = user_id);
