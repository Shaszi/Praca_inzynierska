// Edge Function pośrednicząca w wywołaniach Claude API.
// Klucz ANTHROPIC_API_KEY istnieje tylko po stronie serwera, a prompty są zdefiniowane tutaj,
// więc klient nie może użyć funkcji jako ogólnego proxy do modelu.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL = 'claude-haiku-5-5'
// Haiku 5.5 myśli domyślnie, a myślenie wchodzi w max_tokens — przy 200 tokenach
// odpowiedź skończyłaby się na `max_tokens` jeszcze przed pierwszym zdaniem.
// Te zadania (opis z gotowych liczb, plan ze zdjęcia) nie potrzebują rozumowania.
const NO_THINKING = { type: 'disabled' } as const
const PLAIN_TEXT =
  'Odpowiedz zwykłym tekstem, bez nagłówków, pogrubień ani innego formatowania Markdown. ' +
  'Zwracaj się bezpośrednio do osoby rysującej (np. "Spróbuj...", "Kreska jest..."), nie pisz o "studencie" ' +
  'i unikaj form zależnych od płci (np. "narysowałeś/narysowałaś") — opisuj kreskę, a nie autora.'
const MAX_IMAGE_BASE64_LENGTH = 7_000_000 // ~5 MB po zdekodowaniu
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ImagePayload = { data: string; mediaType: MediaType }

type AiRequest =
  | { action: 'image-steps'; image: ImagePayload }
  | {
      action: 'analyze-image-step'
      referenceImage: ImagePayload
      drawingImage: string
      stepTitle: string
      stepDescription: string
    }
  | { action: 'analyze-stroke'; stepTitle: string; metrics: StrokeMetrics }

// Wynik lokalnego algorytmu oceny kreski (strokeEvaluation.ts). Model dostaje gotowe
// liczby zamiast obrazka: taniej i trafniej, bo nie musi niczego zgadywać z miniatury.
type StrokeSegment = {
  key: 'start' | 'middle' | 'end'
  level: 'good' | 'warn' | 'bad'
  offsetPx: number
  angleDeg: number
  tremorPx: number
  pauses: number
  issues: string[]
}

type StrokeMetrics = {
  score: number
  level: 'good' | 'warn' | 'bad'
  lengthRatio: number
  startGapPx: number
  endGapPx: number
  speedPxPerSec: number
  reversed: boolean
  segments: StrokeSegment[]
}

/** Błąd z komunikatem dla użytkownika (po polsku) i kodem do obsługi po stronie klienta. */
class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function assertImage(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new HttpError(400, `Brak pola ${field}`, 'invalid_input')
  if (value.length > MAX_IMAGE_BASE64_LENGTH) throw new HttpError(413, 'Obraz jest za duży (maks. ok. 5 MB).', 'too_large')
}

function assertImagePayload(value: unknown, field: string): asserts value is ImagePayload {
  const payload = value as Partial<ImagePayload> | null
  assertImage(payload?.data, `${field}.data`)
  if (!MEDIA_TYPES.includes(payload?.mediaType as MediaType)) {
    throw new HttpError(400, 'Nieobsługiwany format obrazu. Użyj JPG, PNG, WebP lub GIF.', 'invalid_input')
  }
}

function assertText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1000) {
    throw new HttpError(400, `Nieprawidłowe pole ${field}`, 'invalid_input')
  }
}

const LEVELS = ['good', 'warn', 'bad']
const SEGMENT_KEYS = ['start', 'middle', 'end']

function assertFinite(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `Nieprawidłowe pole ${field}`, 'invalid_input')
  }
}

/** Walidacja po stronie serwera, bo prompt jest tu składany z tych liczb. */
function assertMetrics(value: unknown): asserts value is StrokeMetrics {
  const m = value as Partial<StrokeMetrics> | null
  if (!m || typeof m !== 'object') throw new HttpError(400, 'Brak pola metrics', 'invalid_input')
  for (const field of ['score', 'lengthRatio', 'startGapPx', 'endGapPx', 'speedPxPerSec'] as const) {
    assertFinite(m[field], `metrics.${field}`)
  }
  if (!LEVELS.includes(m.level as string)) throw new HttpError(400, 'Nieprawidłowe pole metrics.level', 'invalid_input')
  if (typeof m.reversed !== 'boolean') throw new HttpError(400, 'Nieprawidłowe pole metrics.reversed', 'invalid_input')
  if (!Array.isArray(m.segments) || m.segments.length === 0 || m.segments.length > 3) {
    throw new HttpError(400, 'Nieprawidłowe pole metrics.segments', 'invalid_input')
  }
  for (const segment of m.segments) {
    if (!SEGMENT_KEYS.includes(segment?.key) || !LEVELS.includes(segment?.level)) {
      throw new HttpError(400, 'Nieprawidłowy segment', 'invalid_input')
    }
    for (const field of ['offsetPx', 'angleDeg', 'tremorPx', 'pauses'] as const) {
      assertFinite(segment[field], `segment.${field}`)
    }
    if (!Array.isArray(segment.issues) || segment.issues.length > 5) {
      throw new HttpError(400, 'Nieprawidłowe pole issues', 'invalid_input')
    }
    if (segment.issues.some((issue) => typeof issue !== 'string' || issue.length > 40)) {
      throw new HttpError(400, 'Nieprawidłowe pole issues', 'invalid_input')
    }
  }
}

async function requireUser(req: Request): Promise<void> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.', 'unauthorized')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.', 'unauthorized')
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
}

/** Odmowa modelu (klasyfikatory bezpieczeństwa) — content może być wtedy pusty lub niepełny. */
function assertNotRefused(message: Anthropic.Message): void {
  if (message.stop_reason === 'refusal') {
    throw new HttpError(422, 'AI odmówiło analizy tego obrazu. Spróbuj innego zdjęcia.', 'refusal')
  }
}

/** Ucięty komentarz (max_tokens) przycinamy do ostatniego pełnego zdania zamiast pokazywać urwane słowo. */
function completeSentences(message: Anthropic.Message): string {
  assertNotRefused(message)
  const text = textOf(message)
  if (message.stop_reason !== 'max_tokens') return text
  const lastStop = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
  if (lastStop > 0) return text.slice(0, lastStop + 1)
  throw new HttpError(502, 'Odpowiedź AI została ucięta. Spróbuj jeszcze raz.', 'truncated')
}

const IMAGE_STEPS_PROMPT = `Jesteś instruktorem rysunku. Przeanalizuj to zdjęcie i stwórz przewodnik rysowania krok po kroku.

Podziel rysunek na 4-8 kroków. Zacznij od największych, podstawowych kształtów i przejdź do szczegółów.
Każdy krok powinien dotyczyć jednej konkretnej rzeczy do narysowania.

Tytuły i opisy muszą być po polsku. Tytuł: 2–4 słowa. Opis: jedno konkretne zdanie, co narysować.`

// Structured outputs: API gwarantuje JSON zgodny ze schematem — bez wyciągania go regexem z tekstu.
const IMAGE_STEPS_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['steps'],
  additionalProperties: false,
}

type ImageStep = { title: string; description: string }

function parseSteps(message: Anthropic.Message): ImageStep[] {
  assertNotRefused(message)
  // Schemat gwarantuje poprawność tylko pełnej odpowiedzi — po max_tokens JSON jest urwany.
  if (message.stop_reason === 'max_tokens') {
    throw new HttpError(502, 'Plan rysowania okazał się za długi. Spróbuj jeszcze raz.', 'truncated')
  }
  const { steps } = JSON.parse(textOf(message)) as { steps: ImageStep[] }
  const valid = steps.filter((step) => step.title.trim() && step.description.trim()).slice(0, 8)
  if (valid.length === 0) {
    throw new HttpError(502, 'AI nie przygotowało planu dla tego zdjęcia. Spróbuj innego.', 'empty')
  }
  return valid
}

function imageStepPrompt(title: string, description: string): string {
  return `Pierwsze zdjęcie: wzorzec (oryginalne zdjęcie).
Drugie zdjęcie: rysunek użytkownika. Czarna kreska to ta z tego kroku i tylko ją oceniasz;
szare kreski to wcześniejsze kroki — są kontekstem, nie przedmiotem oceny. Rysunek jest
dopasowany do kadru, więc nie oceniaj jego położenia ani wielkości względem wzorca.
Krok: "${title}"
Opis kroku: "${description}"

Oceń ten krok w 1–2 krótkich zdaniach po polsku (razem maks. ~25 słów).
Najpierw to, co jest źle i gdzie, potem to, co jest dobre. Bez wstępów, bez rad ogólnych.
Przykład stylu: "Kontur kubka jest za wąski u dołu. Elipsa otworu jest dobra i płynna."`
}

// Progi w opisie są tymi samymi stałymi, które liczy strokeEvaluation.ts — poza odchyleniem,
// bo jego tolerancja rośnie z długością i grubością wzoru. Dlatego dla odchylenia model ma
// patrzeć na gotowy `level`, a nie na piksele.
const STROKE_SYSTEM = `Jesteś instruktorem rysunku. Oceniasz jedno pociągnięcie, którym ktoś odrysował wzorcową linię.

Nie widzisz rysunku — dostajesz pomiary z algorytmu. Odczytuj je tak:
- level: werdykt algorytmu (good = dobrze, warn = do poprawy, bad = źle). Dla odchylenia od wzoru to jedyna miara, której ufasz, bo tolerancja zależy od długości wzoru.
- issues: nazwy wykrytych błędów. offset = kreska odjechała od wzoru, waver = faluje raz z jednej, raz z drugiej strony, angle = zły kierunek, tremor = drżenie ręki, pause = ruch się zatrzymał.
- offsetPx: średnia odległość od wzoru w pikselach.
- angleDeg: różnica kierunku w stopniach (do 7 dobrze, od 16 źle).
- tremorPx: drżenie (do 0,7 dobrze, od 1,4 źle).
- pauses: ile razy ruch stanął w tym fragmencie.
- lengthRatio: długość względem wzoru (1 = równo, 0,8 = o 20% za krótka, 1,2 = o 20% za długa).
- startGapPx, endGapPx: o ile pikseli kreska zaczyna się i kończy obok końców wzoru.
- speedPxPerSec: tempo (poniżej 50 to wyrysowywanie, powyżej 90 to pewny ruch).
- reversed: kreska prowadzona od końca wzoru do początku.
- segments: te same pomiary osobno dla początku, środka i końca kreski.

Wypełnij dwa pola po polsku:
mistake — co konkretnie jest nie tak i w którym fragmencie kreski. Jedno zdanie, maks. 18 słów. Gdy wszystkie pomiary są dobre, napisz, co w tej kresce wyszło.
fix — jedna rada, co zrobić inaczej w kolejnej próbie: ruch ręki, tempo, punkt startu. Jedno zdanie, maks. 18 słów.

Odnoś się do najgorszego pomiaru, nie wyliczaj wszystkich. Nie przepisuj liczb ani nazw pól do odpowiedzi.
${PLAIN_TEXT}`

const STROKE_SCHEMA = {
  type: 'object',
  properties: {
    mistake: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['mistake', 'fix'],
  additionalProperties: false,
}

type StrokeComment = { mistake: string; fix: string }

function parseStrokeComment(message: Anthropic.Message): StrokeComment {
  assertNotRefused(message)
  // Schemat gwarantuje poprawny JSON tylko dla pełnej odpowiedzi.
  if (message.stop_reason === 'max_tokens') {
    throw new HttpError(502, 'Odpowiedź AI została ucięta. Spróbuj jeszcze raz.', 'truncated')
  }
  const comment = JSON.parse(textOf(message)) as StrokeComment
  if (!comment.mistake?.trim() || !comment.fix?.trim()) {
    throw new HttpError(502, 'AI nie opisało tej kreski. Spróbuj jeszcze raz.', 'empty')
  }
  return { mistake: comment.mistake.trim(), fix: comment.fix.trim() }
}

async function handle(client: Anthropic, body: AiRequest): Promise<unknown> {
  switch (body.action) {
    case 'image-steps': {
      assertImagePayload(body.image, 'image')
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        thinking: NO_THINKING,
        output_config: { format: { type: 'json_schema', schema: IMAGE_STEPS_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.image.mediaType, data: body.image.data } },
            { type: 'text', text: IMAGE_STEPS_PROMPT },
          ],
        }],
      })
      return { steps: parseSteps(message) }
    }

    case 'analyze-image-step': {
      assertImagePayload(body.referenceImage, 'referenceImage')
      assertImage(body.drawingImage, 'drawingImage')
      assertText(body.stepTitle, 'stepTitle')
      assertText(body.stepDescription, 'stepDescription')
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        thinking: NO_THINKING,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: body.referenceImage.mediaType, data: body.referenceImage.data },
              // Wzorzec jest ten sam przy każdej kresce, a jest największą częścią wejścia:
              // odczyt z cache kosztuje 0,1x. Działa od 512 tokenów prefiksu — małe zdjęcie
              // po prostu się nie zbuforuje, bez błędu.
              cache_control: { type: 'ephemeral' },
            },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: body.drawingImage } },
            { type: 'text', text: `${imageStepPrompt(body.stepTitle, body.stepDescription)}\n\n${PLAIN_TEXT}` },
          ],
        }],
      })
      return { text: completeSentences(message) }
    }

    case 'analyze-stroke': {
      assertText(body.stepTitle, 'stepTitle')
      assertMetrics(body.metrics)
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        thinking: NO_THINKING,
        // Zmierzone: sam prompt to ~1250 tokenów, czyli powyżej progu 512 — i jest ten sam
        // przy każdej kresce. Odczyt z cache kosztuje 0,1x, więc wejście tanieje ~4x.
        system: [{ type: 'text', text: STROKE_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: STROKE_SCHEMA } },
        messages: [{
          role: 'user',
          content: `Wzorzec: "${body.stepTitle}"
Pomiary: ${JSON.stringify(body.metrics)}`,
        }],
      })
      // Koszt tej akcji jest sednem wyboru modelu, więc zużycie tokenów idzie do logów.
      console.log('analyze-stroke usage', JSON.stringify(message.usage))
      return parseStrokeComment(message)
    }

    default:
      throw new HttpError(400, 'Nieznana akcja', 'invalid_input')
  }
}

/**
 * Mapuje błędy na odpowiedzi dla klienta. Klasy SDK sprawdzane od najbardziej szczegółowej:
 * ponowienie ma sens tylko przy 429 / przeciążeniu / sieci, przy błędzie konfiguracji — nie.
 * (SDK samo ponawia 408/409/429/5xx i błędy połączenia 2 razy, zanim błąd tu trafi.)
 */
function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error('Anthropic auth error', error.status, error.message)
    return new HttpError(500, 'Serwer ma nieprawidłowy klucz API Anthropic.', 'config')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(429, 'Za dużo zapytań do AI. Spróbuj za chwilę.', 'rate_limited')
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('Anthropic bad request', error.message)
    return new HttpError(400, 'AI nie mogło przetworzyć tego obrazu. Spróbuj innego pliku.', 'bad_request')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    console.error('Anthropic connection error', error.message)
    return new HttpError(502, 'Brak połączenia z usługą AI. Spróbuj ponownie.', 'connection')
  }
  if (error instanceof Anthropic.InternalServerError || (error instanceof Anthropic.APIError && error.status === 529)) {
    return new HttpError(503, 'Usługa AI jest chwilowo przeciążona. Spróbuj za chwilę.', 'overloaded')
  }
  if (error instanceof Anthropic.APIError) {
    console.error('Anthropic API error', error.status, error.message)
    return new HttpError(502, 'Błąd usługi AI. Spróbuj ponownie.', 'api_error')
  }
  if (error instanceof SyntaxError) {
    console.error('Invalid JSON', error.message)
    return new HttpError(502, 'AI zwróciło nieprawidłową odpowiedź. Spróbuj ponownie.', 'invalid_output')
  }
  console.error(error)
  return new HttpError(500, 'Wewnętrzny błąd serwera.', 'internal')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda niedozwolona', code: 'method' }, 405)

  try {
    await requireUser(req)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new HttpError(500, 'Serwer nie ma skonfigurowanego klucza ANTHROPIC_API_KEY.', 'config')

    const body = (await req.json().catch(() => {
      throw new HttpError(400, 'Nieprawidłowe żądanie.', 'invalid_input')
    })) as AiRequest
    return json(await handle(new Anthropic({ apiKey }), body))
  } catch (error) {
    const failure = toHttpError(error)
    return json({ error: failure.message, code: failure.code }, failure.status)
  }
})
