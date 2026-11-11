-- Szczegółowa, algorytmiczna ocena kreski (tryb wzorca).
-- feedback: krótki komentarz pokazany użytkownikowi,
-- metrics: wyniki per fragment (początek/środek/koniec) i dla całej kreski — podstawa
-- do późniejszego wykrywania powtarzających się błędów (nawyków).
alter table public.practice_attempts
  add column feedback text,
  add column metrics jsonb check (metrics is null or jsonb_typeof(metrics) = 'object');

comment on column public.practice_attempts.ai_feedback is 'Komentarz modelu AI (tryb rysowania ze zdjęcia).';
comment on column public.practice_attempts.feedback is 'Komentarz z algorytmicznej oceny kreski (tryb wzorca).';
