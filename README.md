# Kreska — trener rysunku

Aplikacja webowa do codziennego ćwiczenia kreski: odrysowywanie wzorców kreska po kresce, rysunek ze zdjęcia rozpisany przez AI na kroki, cel w dniach i historia postępów zapisywana na koncie użytkownika.

## Architektura

```text
Przeglądarka (React + Vite)
  │  supabase-js (sesja JWT)
  ▼
Supabase (uruchamiany lokalnie w Dockerze)
  ├─ Auth (GoTrue)        — email + hasło, Google OAuth
  ├─ PostgREST            — REST API nad bazą, dostęp ograniczony przez RLS
  ├─ PostgreSQL           — profile, wzorce, sesje ćwiczeń, próby
  └─ Edge Function `ai`   — pośrednik do Claude API; klucz Anthropic tylko na serwerze
```

### Model danych (`supabase/migrations`)

| Tabela / widok | Zawartość |
|---|---|
| `profiles` | nazwa użytkownika, cel (`goal_days`, `goal_started_on`), strefa czasowa |
| `drawing_references` | wzorce kresek tworzone w edytorze |
| `practice_sessions` | jeden rysunek (tryb wzorca lub zdjęcia), średnia ocena, końcowe kreski |
| `practice_attempts` | pojedyncze kreski w sesji: ocena geometryczna i komentarz AI |
| `daily_activity` (widok) | liczba ukończonych rysunków na dzień w strefie czasowej użytkownika |

Każda tabela ma włączone Row Level Security — użytkownik ma dostęp wyłącznie do własnych wierszy. Profil tworzy się automatycznie po rejestracji (trigger `on_auth_user_created`).

**Cel:** dzień zalicza się do celu, jeśli użytkownik ukończy w nim co najmniej jeden rysunek. Logika celu, serii i kalendarza aktywności jest w `src/features/progress/utils/goalProgress.ts` (z testami).

## Uruchomienie lokalne

Wymagania: Node.js 20+, Docker Desktop.

```bash
npm install

# 1. Sekrety
cp supabase/functions/.env.example supabase/functions/.env   # wpisz ANTHROPIC_API_KEY
cp supabase/.env.example supabase/.env                       # dane Google OAuth (opcjonalnie)

# 2. Backend: baza, auth, API (pierwsze uruchomienie pobiera obrazy Dockera)
npx supabase start

# 3. Frontend: skopiuj "Publishable"/"anon key" z wyniku `npx supabase status`
cp .env.example .env.local
npm run dev

# 4. Edge Function z AI (osobny terminal)
npx supabase functions serve --env-file supabase/functions/.env
```

- Aplikacja: http://localhost:5173
- Panel bazy (Supabase Studio): http://127.0.0.1:54323
- Skrzynka testowa na maile z auth (Mailpit): http://127.0.0.1:54324

Po zmianie schematu: `npx supabase migration new <nazwa>`, potem `npx supabase db reset` i `npm run db:types`.

### Logowanie przez Google

1. Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (typ *Web application*).
2. Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`.
3. Wpisz Client ID i Secret do `supabase/.env`, następnie `npx supabase stop && npx supabase start`.

## Skrypty

| Polecenie | Opis |
|---|---|
| `npm run dev` | serwer deweloperski Vite |
| `npm run build` | sprawdzenie typów i build produkcyjny |
| `npm test` | testy jednostkowe (Vitest) |
| `npm run lint` | ESLint |
| `npm run db:types` | generuje typy TS ze schematu bazy do `src/lib/database.types.ts` |

## Struktura

```text
src/
  components/          AppShell (menu), BrandMark, ikony
  features/
    auth/              AuthProvider, strona logowania/rejestracji, RequireAuth
    canvas/            silnik płótna, wygładzanie kresek
    practice/          ćwiczenia z wzorcem, analiza podobieństwa
    progress/          cel, seria, kalendarz aktywności, zapis sesji
    teacher/           edytor wzorców (zapis w tabeli drawing_references)
  lib/                 klient Supabase i typy bazy
  pages/               strony routera (/, /login, /app/...)
  services/            wywołania AI przez Edge Function
supabase/
  config.toml          konfiguracja lokalnego stosu
  migrations/          schemat bazy + RLS
  functions/ai/        Edge Function pośrednicząca do Claude API
```

## Licencje wykorzystanego oprogramowania

| Komponent | Licencja |
|---|---|
| Supabase (CLI, Studio, Realtime, Storage) | Apache-2.0 / MIT |
| Supabase Auth (GoTrue), PostgREST, supabase-js | MIT |
| PostgreSQL | PostgreSQL License |
| React, Vite, Vitest, React Router | MIT |
| Tailwind CSS | MIT |
| Anthropic SDK (`@anthropic-ai/sdk`, w Edge Function) | MIT |
| Fonty Geist, Instrument Serif | SIL Open Font License 1.1 |
