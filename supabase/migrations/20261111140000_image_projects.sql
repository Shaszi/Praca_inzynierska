-- ---------------------------------------------------------------------------
-- Powrót do projektu rysowanego ze zdjęcia.
--
-- Do tej pory zdjęcie żyło wyłącznie jako obiekt URL w karcie przeglądarki i ginęło
-- przy odświeżeniu. Żeby dało się wrócić do rysunku razem ze zdjęciem pod spodem,
-- potrzebne są trzy rzeczy: plik w Storage, plan kursu i numer kroku, na którym
-- ćwiczący skończył.
--
-- Kurs trzymamy w całości w kolumnie, a nie odtwarzamy go z obrazu przy powrocie:
-- detekcja konturów i zapytanie do modelu dałyby za drugim razem inny podział
-- na kroki, więc „ten sam projekt" przestałby być ten sam.
-- ---------------------------------------------------------------------------

alter table public.practice_sessions
  add column photo_path text,
  add column course jsonb check (course is null or jsonb_typeof(course) = 'array'),
  add column step_index integer not null default 0 check (step_index >= 0);

comment on column public.practice_sessions.photo_path is
  'Ścieżka w buckecie practice-photos: <user_id>/<session>.jpg. NULL dla trybu z wzorcem.';
comment on column public.practice_sessions.course is
  'Kroki kursu ze zdjęcia razem z geometrią konturów — pozwalają wrócić do tego samego podziału.';
comment on column public.practice_sessions.step_index is
  'Krok, na którym ćwiczący skończył. Od niego wznawiamy projekt.';

-- Prywatny bucket: zdjęcia są materiałem użytkownika, nie treścią publiczną.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'practice-photos',
  'practice-photos',
  false,
  6 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Pierwszy człon ścieżki to id właściciela. Dzięki temu polityka jest jednym
-- porównaniem i nie wymaga zaglądania do practice_sessions przy każdym pliku.
create policy "Zdjęcia: odczyt własnych"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'practice-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Zdjęcia: wgrywanie własnych"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'practice-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Zdjęcia: usuwanie własnych"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'practice-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
