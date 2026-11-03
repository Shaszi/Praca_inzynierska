// Edge Function pośrednicząca w wywołaniach Claude API.
// Klucz ANTHROPIC_API_KEY istnieje tylko po stronie serwera, a prompty są zdefiniowane tutaj,
// więc klient nie może użyć funkcji jako ogólnego proxy do modelu.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL = 'claude-haiku-4-5-20251001'
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
Drugie zdjęcie: rysunek wykonany dla kroku "${title}".
Opis kroku: "${description}"

Oceń ten krok w 1–2 krótkich zdaniach po polsku (razem maks. ~25 słów).
Najpierw to, co jest źle i gdzie, potem to, co jest dobre. Bez wstępów, bez rad ogólnych.
Przykład stylu: "Kontur kubka jest za wąski u dołu. Elipsa otworu jest dobra i płynna."`
}

async function handle(client: Anthropic, body: AiRequest): Promise<unknown> {
  switch (body.action) {
    case 'image-steps': {
      assertImagePayload(body.image, 'image')
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: body.referenceImage.mediaType, data: body.referenceImage.data },
            },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: body.drawingImage } },
            { type: 'text', text: `${imageStepPrompt(body.stepTitle, body.stepDescription)}\n\n${PLAIN_TEXT}` },
          ],
        }],
      })
      return { text: completeSentences(message) }
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
