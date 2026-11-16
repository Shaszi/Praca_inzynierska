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
const MAX_IMAGE_BASE64_LENGTH = 7_000_000
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ImagePayload = { data: string; mediaType: MediaType }

type AiRequest =
  | {
      action: 'analyze-image-step'
      referenceImage: ImagePayload
      drawingImage: string
      stepTitle: string
      stepDescription: string
    }
  | { action: 'analyze-stroke'; stepTitle: string; metrics: StrokeMetrics }
  | { action: 'plan-contours'; image: ImagePayload; overlay: ImagePayload; contours: ContourSummary[]; hasMask: boolean; focus?: LabelFocus }
  | { action: 'locate-parts'; image: ImagePayload }

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

type ContourSummary = {
  i: number
  box: [number, number, number, number]
  len: number
  closed: boolean
  role: 'outline' | 'structure' | 'detail'
  part?: string
}

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

const MAX_CONTOURS_IN = 250

function assertContours(value: unknown): asserts value is ContourSummary[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CONTOURS_IN) {
    throw new HttpError(400, 'Nieprawidłowa lista konturów.', 'invalid_input')
  }
  for (const contour of value) {
    const c = contour as Partial<ContourSummary>
    assertFinite(c?.i, 'contour.i')
    assertFinite(c?.len, 'contour.len')
    if (typeof c?.closed !== 'boolean') throw new HttpError(400, 'Nieprawidłowe pole closed', 'invalid_input')
    if (!['outline', 'structure', 'detail'].includes(c?.role as string)) {
      throw new HttpError(400, 'Nieprawidłowe pole role', 'invalid_input')
    }
    if (c?.part !== undefined && (typeof c.part !== 'string' || c.part.length > 80)) {
      throw new HttpError(400, 'Nieprawidłowe pole part', 'invalid_input')
    }
    if (!Array.isArray(c?.box) || c.box.length !== 4) {
      throw new HttpError(400, 'Nieprawidłowe pole box', 'invalid_input')
    }
    for (const n of c.box) assertFinite(n, 'contour.box')
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

function assertNotRefused(message: Anthropic.Message): void {
  if (message.stop_reason === 'refusal') {
    throw new HttpError(422, 'AI odmówiło analizy tego obrazu. Spróbuj innego zdjęcia.', 'refusal')
  }
}

function completeSentences(message: Anthropic.Message): string {
  assertNotRefused(message)
  const text = textOf(message)
  if (message.stop_reason !== 'max_tokens') return text
  const lastStop = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
  if (lastStop > 0) return text.slice(0, lastStop + 1)
  throw new HttpError(502, 'Odpowiedź AI została ucięta. Spróbuj jeszcze raz.', 'truncated')
}

const CONTOUR_LABEL_PROMPT = `Jesteś instruktorem rysunku. Program przygotował już kurs rysowania
ze zdjęcia: wybrał linie i ustalił ich kolejność. Twoim jedynym zadaniem jest nazwać kroki.
Nie zmieniasz kolejności, nie łączysz i nie usuwasz kroków.

OBRAZY
Pierwszy obraz to oryginalne zdjęcie. Drugi to linie kursu narysowane na zdjęciu: każda ma
swój kolor i numer przy środku. Numer to numer kroku z listy poniżej. Zanim nazwiesz krok,
znajdź jego numer na drugim obrazie i sprawdź, co ta linia naprawdę obrysowuje. Nie zgaduj
po samej ramce.

CZĘŚCI
Każdy krok ma pole "part" — część obrazka, którą program już rozpoznał (np. „Oko — lewa
strona”, „Kosmyki włosów”, „Linia szczęki i podbródek”). Nie zmieniaj przypisania do części.
Tytuł ma mówić, CO w tej części rysujemy teraz: „Górna powieka”, „Kosmyk nad czołem”,
„Kącik ust”, a nie powtarzać nazwę części. Kroki jednej części idą po sobie — nazwij je tak,
żeby było widać, że to kolejne fragmenty tej samej rzeczy.

ROLE KROKÓW
- "outline": linia leży na obrysie obiektu (sylwetka, zewnętrzna krawędź).
- "structure": długa linia wewnątrz obiektu, która buduje bryłę.
- "detail": krótsza linia detalu.

POLA
- "subject": jednym-dwoma słowami, co jest głównym obiektem zdjęcia.
- Dla każdego kroku "i" (numer z listy), "title" i "description".
- "background": true tylko wtedy, gdy linia NIE należy do głównego obiektu (ściana, niebo,
  meble, inne osoby, krawędź kadru). Jeśli na zdjęciu jest człowiek albo zwierzę, to on jest
  głównym obiektem; w przeciwnym razie rzecz najbardziej wyeksponowana.

TEKST
Tytuł: 2-5 słów, nazwij rzecz po imieniu, patrząc na zdjęcie ("Linia ramienia", "Obrys
głowy — lewa strona", a nie "Kontur 3"). Kolejne odcinki tej samej rzeczy rozróżnij
(lewa/prawa, góra/dół). Opis: jedno krótkie zdanie (do 12 słów), jak poprowadzić rękę, po polsku.`

const MASK_NOTE = `
UWAGA: użytkownik sam zaznaczył obiekt (stuknięciem albo lassem) i program wziął linie tylko
z zaznaczenia. Wszystkie linie należą do obiektu — w każdym kroku ustaw "background": false.`

const FACE_PART_KINDS = ['brow-left', 'brow-right', 'eye-left', 'eye-right', 'nose', 'mouth', 'hair-strands'] as const

const LOCATE_PROMPT = `Na obrazie znajdź twarz głównego obiektu: człowieka, zwierzęcia, postaci z rysunku,
komiksu albo kreskówki, rzeźby. Dla każdej widocznej części podaj prostokąt we współrzędnych
0–1 względem szerokości i wysokości obrazu (x0,y0 — lewy górny róg, x1,y1 — prawy dolny).
Części: eye-left i eye-right (oko po lewej / prawej stronie OBRAZU, prostokąt obejmuje całe oko
z powiekami i rzęsami), brow-left, brow-right, nose, mouth, hair-strands (cała fryzura albo
sierść na głowie). Pomiń części niewidoczne. Jeśli na obrazie nie ma żadnej twarzy, zwróć
pustą listę "parts".`

const LOCATE_SCHEMA = {
  type: 'object',
  properties: {
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...FACE_PART_KINDS] },
          x0: { type: 'number' },
          y0: { type: 'number' },
          x1: { type: 'number' },
          y1: { type: 'number' },
        },
        required: ['kind', 'x0', 'y0', 'x1', 'y1'],
        additionalProperties: false,
      },
    },
  },
  required: ['parts'],
  additionalProperties: false,
}

type LocatedPart = { kind: (typeof FACE_PART_KINDS)[number]; x0: number; y0: number; x1: number; y1: number }

const unit = (n: unknown) => Math.min(1, Math.max(0, Number(n)))

function parseLocatedParts(message: Anthropic.Message): LocatedPart[] {
  assertNotRefused(message)
  const { parts } = JSON.parse(textOf(message)) as { parts?: LocatedPart[] }
  const seen = new Set<string>()
  return (Array.isArray(parts) ? parts : []).flatMap((part) => {
    if (!(FACE_PART_KINDS as readonly string[]).includes(part?.kind) || seen.has(part.kind)) return []
    const box = { x0: unit(part.x0), y0: unit(part.y0), x1: unit(part.x1), y1: unit(part.y1) }
    if (![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite) || box.x1 <= box.x0 || box.y1 <= box.y0) return []
    seen.add(part.kind)
    return [{ kind: part.kind, ...box }]
  })
}

type LabelFocus = 'eyes' | 'face' | 'hair'

const FOCUS_ZOOM = `
ZBLIŻENIE: oba obrazy to powiększony fragment zdjęcia, a ramki "box" są liczone względem
tego fragmentu. Wszystkie linie należą do obiektu — w każdym kroku ustaw "background": false.`

const FOCUS_NOTES: Record<LabelFocus, string> = {
  eyes: `${FOCUS_ZOOM}
Na fragmencie są OCZY I BRWI. Każda linia to część oka albo brwi — nazwij ją dokładnie:
górna lub dolna powieka, załamanie powieki, tęczówka, źrenica, kącik oka, rzęsy, łuk brwi.
Zawsze podaj stronę (lewe/prawe oko na zdjęciu). Opisz, jak delikatnie poprowadzić kreskę.`,
  face: `${FOCUS_ZOOM}
Na fragmencie jest TWARZ (bez oczu — te są w osobnym kursie). Nazywaj: owal i podbródek,
linia czoła, grzbiet nosa, skrzydełka i nozdrza, górna i dolna warga, kąciki ust.`,
  hair: `${FOCUS_ZOOM}
Na fragmencie są WŁOSY. Nazywaj: zarys fryzury, przedziałek, kosmyki — rozróżniaj je
położeniem (nad czołem, przy skroni, na czubku, za uchem) i kierunkiem, w którym opadają.`,
}

const CONTOUR_LABEL_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    labels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          background: { type: 'boolean' },
        },
        required: ['i', 'title', 'description', 'background'],
        additionalProperties: false,
      },
    },
  },
  required: ['subject', 'labels'],
  additionalProperties: false,
}

type ContourLabel = { i: number; title: string; description: string; background: boolean }

function parseContourLabels(message: Anthropic.Message, available: number[]): ContourLabel[] {
  assertNotRefused(message)
  const labels = message.stop_reason === 'max_tokens'
    ? completeLabels(textOf(message))
    : (JSON.parse(textOf(message)) as { labels: ContourLabel[] }).labels
  const left = new Set(available)
  return (Array.isArray(labels) ? labels : [])
    .filter((label) => typeof label?.i === 'number' && left.delete(label.i))
    .map((label) => ({
      i: label.i,
      title: String(label.title ?? '').trim().slice(0, 80),
      description: String(label.description ?? '').trim().slice(0, 300),
      background: label.background === true,
    }))
}

// Ucięta odpowiedź nie jest poprawnym JSON-em, ale pełne obiekty przed cięciem są —
// brakujące kroki dostaną u klienta nazwę po roli.
function completeLabels(text: string): ContourLabel[] {
  const labels: ContourLabel[] = []
  for (const match of text.matchAll(/\{[^{}]*\}/g)) {
    try {
      labels.push(JSON.parse(match[0]) as ContourLabel)
    } catch {
      // obiekt urwany w połowie
    }
  }
  return labels
}

function imageStepPrompt(title: string, description: string): string {
  return `Pierwsze zdjęcie: wzorzec (oryginalne zdjęcie).
Drugie zdjęcie: rysunek użytkownika. Czarne kreski to ten krok — może być kilka pociągnięć,
którymi użytkownik dorysowuje tę samą linię; oceniaj je razem jako jedną linię, a nie każde osobno.
Szare kreski to wcześniejsze kroki — są kontekstem, nie przedmiotem oceny. Rysunek jest
dopasowany do kadru, więc nie oceniaj jego położenia ani wielkości względem wzorca.
Krok: "${title}"
Opis kroku: "${description}"

Oceń ten krok w 1–2 krótkich zdaniach po polsku (razem maks. ~25 słów).
Najpierw to, co jest źle i gdzie, potem to, co jest dobre. Bez wstępów, bez rad ogólnych.
Przykład stylu: "Kontur kubka jest za wąski u dołu. Elipsa otworu jest dobra i płynna."`
}

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
              cache_control: { type: 'ephemeral' },
            },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: body.drawingImage } },
            { type: 'text', text: `${imageStepPrompt(body.stepTitle, body.stepDescription)}\n\n${PLAIN_TEXT}` },
          ],
        }],
      })
      return { text: completeSentences(message) }
    }

    case 'plan-contours': {
      assertImagePayload(body.image, 'image')
      assertImagePayload(body.overlay, 'overlay')
      assertContours(body.contours)
      if (body.focus !== undefined && !Object.hasOwn(FOCUS_NOTES, body.focus as string)) {
        throw new HttpError(400, 'Nieprawidłowe pole focus', 'invalid_input')
      }
      const note = body.focus ? FOCUS_NOTES[body.focus] : body.hasMask === true ? MASK_NOTE : ''
      const list = body.contours
        .map((c) => `${c.i}: part="${c.part ?? ''}" role=${c.role} box=[${c.box.map((n) => n.toFixed(2)).join(', ')}] len=${c.len.toFixed(3)} closed=${c.closed}`)
        .join(String.fromCharCode(10))
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: NO_THINKING,
        output_config: { format: { type: 'json_schema', schema: CONTOUR_LABEL_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.image.mediaType, data: body.image.data } },
            { type: 'image', source: { type: 'base64', media_type: body.overlay.mediaType, data: body.overlay.data } },
            { type: 'text', text: CONTOUR_LABEL_PROMPT + note + String.fromCharCode(10, 10) + 'KROKI (w kolejności rysowania):' + String.fromCharCode(10) + list },
          ],
        }],
      })
      return { labels: parseContourLabels(message, body.contours.map((c) => c.i)) }
    }

    case 'locate-parts': {
      assertImagePayload(body.image, 'image')
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1000,
        thinking: NO_THINKING,
        output_config: { format: { type: 'json_schema', schema: LOCATE_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.image.mediaType, data: body.image.data } },
            { type: 'text', text: LOCATE_PROMPT },
          ],
        }],
      })
      return { parts: message.stop_reason === 'max_tokens' ? [] : parseLocatedParts(message) }
    }

    case 'analyze-stroke': {
      assertText(body.stepTitle, 'stepTitle')
      assertMetrics(body.metrics)
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        thinking: NO_THINKING,
        system: [{ type: 'text', text: STROKE_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: STROKE_SCHEMA } },
        messages: [{
          role: 'user',
          content: `Wzorzec: "${body.stepTitle}"
Pomiary: ${JSON.stringify(body.metrics)}`,
        }],
      })
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
