-- ---------------------------------------------------------------------------
-- Publikacja wzorców do wspólnej biblioteki.
--
-- Jedna kolumna stanu, nie para (widoczność, status moderacji). Dwie kolumny
-- pozwalałyby na stan sprzeczny („publiczny, ale czeka na moderację") i wymuszałyby
-- dwa predykaty w każdej polityce i każdym zapytaniu.
--
--   private  -> widzi tylko autor
--   pending  -> czeka na moderatora (AI uznało za podejrzane albo zawiodło)
--   public   -> widzą wszyscy zalogowani
--   rejected -> odrzucone przez moderatora, widzi tylko autor
-- ---------------------------------------------------------------------------

alter table public.drawing_references
  add column publication text not null default 'private'
    check (publication in ('private', 'pending', 'public', 'rejected')),
  add column moderation_reason text check (char_length(moderation_reason) <= 500),
  add column moderated_by uuid references auth.users (id) on delete set null,
  add column moderated_at timestamptz;

create index drawing_references_public_created_idx
  on public.drawing_references (created_at desc)
  where publication = 'public';

-- ---------------------------------------------------------------------------
-- Status nie może być ustawialny przez autora.
--
-- RLS nie potrafi ograniczyć, KTÓRYCH kolumn dotyczy update — potrafią to uprawnienia
-- kolumnowe, a PostgREST działa jako rola `authenticated`. Dzięki temu żadne żądanie
-- z przeglądarki nie dotknie publication ani decyzji moderatora, niezależnie od polityk.
--
-- Skutek uboczny jest zamierzony: strokes stają się niezmienne po utworzeniu, więc nie
-- da się podmienić treści wzorca PO jego zatwierdzeniu.
-- ---------------------------------------------------------------------------
revoke insert, update on public.drawing_references from authenticated;
grant insert (name, strokes) on public.drawing_references to authenticated;
grant update (name) on public.drawing_references to authenticated;

-- Druga warstwa, na wypadek gdyby ktoś w przyszłości przywrócił szersze uprawnienia.
drop policy "Wzorce: dodawanie własnych" on public.drawing_references;
create policy "Wzorce: dodawanie własnych" on public.drawing_references
  for insert to authenticated
  with check ((select auth.uid()) = user_id and publication = 'private');

-- Odczyt: własne, opublikowane, a moderator widzi wszystko (potrzebuje tego kolejka).
drop policy "Wzorce: odczyt własnych" on public.drawing_references;
create policy "Wzorce: odczyt własnych i opublikowanych" on public.drawing_references
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or publication = 'public'
    or public.has_role('moderator')
  );

-- ---------------------------------------------------------------------------
-- Zapis sesji na cudzym wzorcu.
--
-- Stara polityka wymagała, żeby reference_id należał do ćwiczącego. Bez tej zmiany
-- ćwiczenie na opublikowanym wzorcu kogoś innego rysowałoby się poprawnie, a padało
-- dopiero przy zapisie sesji. Warunek jest lustrzany do polityki SELECT, więc „widzę"
-- i „mogę ćwiczyć" nigdy się nie rozjeżdżają.
-- ---------------------------------------------------------------------------
drop policy "Sesje: dodawanie własnych" on public.practice_sessions;
create policy "Sesje: dodawanie własnych" on public.practice_sessions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      reference_id is null
      or exists (
        select 1
        from public.drawing_references r
        where r.id = reference_id
          and (r.user_id = (select auth.uid()) or r.publication = 'public')
      )
    )
  );

-- Nazwa autora przy opublikowanym wzorcu. Bez tego biblioteka pokazywałaby surowe
-- user_id. Udostępniamy display_name wyłącznie osób, które coś opublikowały.
create policy "Profil: odczyt nazwy autora opublikowanego wzorca" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.drawing_references r
      where r.user_id = public.profiles.id
        and r.publication = 'public'
    )
  );

-- ---------------------------------------------------------------------------
-- Decyzja moderatora.
--
-- Rola jest sprawdzana w ciele funkcji, więc warunek obowiązuje każdego wywołującego,
-- także takiego, który uderzy w PostgREST z ręki. Predykat publication = 'pending'
-- pilnuje, żeby moderator nie sięgnął do prywatnych wzorców ani nie przesądzał
-- sprawy już rozstrzygniętej.
-- ---------------------------------------------------------------------------
create function public.moderate_reference(
  p_reference_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Brak uprawnień moderatora' using errcode = '42501';
  end if;

  update public.drawing_references
  set publication = case when p_approved then 'public' else 'rejected' end,
      moderation_reason = left(p_reason, 500),
      moderated_by = (select auth.uid()),
      moderated_at = now()
  where id = p_reference_id
    and publication = 'pending';

  if not found then
    raise exception 'Ten wzorzec nie czeka na moderację' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.moderate_reference(uuid, boolean, text) from public, anon;
grant execute on function public.moderate_reference(uuid, boolean, text) to authenticated;
