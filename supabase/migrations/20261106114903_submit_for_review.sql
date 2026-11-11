-- ---------------------------------------------------------------------------
-- Zgłoszenie własnego wzorca do wspólnej biblioteki.
--
-- Autor nie ma uprawnienia do kolumny publication (patrz migracja
-- reference_publication), więc zgłoszenie musi przejść przez funkcję. Funkcja
-- ustawia wyłącznie 'pending' — zatwierdzenie należy do moderatora albo, po
-- wdrożeniu bramki AI, do Edge Function działającej na kluczu service-role.
--
-- Dzięki temu nie istnieje żadna ścieżka, w której użytkownik publikuje sam siebie.
-- ---------------------------------------------------------------------------
create function public.submit_reference_for_review(p_reference_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.drawing_references
  set publication = 'pending',
      moderation_reason = null,
      moderated_by = null,
      moderated_at = null
  where id = p_reference_id
    and user_id = (select auth.uid())
    and publication in ('private', 'rejected');

  if not found then
    raise exception 'Tego wzorca nie można zgłosić' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.submit_reference_for_review(uuid) from public, anon;
grant execute on function public.submit_reference_for_review(uuid) to authenticated;
