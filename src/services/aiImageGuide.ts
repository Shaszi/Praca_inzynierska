import Anthropic from '@anthropic-ai/sdk'
import type { Stroke } from '../types/drawing'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('BRAK_KLUCZA')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function parseStepsFromResponse(text: string): ImageGuideStep[] {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```[a-z]*\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Brak JSON w odpowiedzi')
  const parsed = JSON.parse(match[0]) as { steps: { title: string; description: string }[] }
  return parsed.steps.map((s, i) => ({ id: `step-${i}`, title: s.title, description: s.description }))
}

export async function generateImageSteps(
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<ImageGuideStep[]> {
  const client = getClient()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `Jesteś instruktorem rysunku. Przeanalizuj to zdjęcie i stwórz przewodnik rysowania krok po kroku.

Podziel rysunek na 4-8 kroków. Zacznij od największych, podstawowych kształtów i przejdź do szczegółów.
Każdy krok powinien dotyczyć jednej konkretnej rzeczy do narysowania.

Odpowiedz TYLKO w formacie JSON (bez markdown):
{"steps": [{"title": "Krótki tytuł kroku", "description": "Dokładna instrukcja co narysować w tym kroku"}, ...]}

Tytuły i opisy muszą być po polsku. Opisy powinny być konkretne i pomocne.`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseStepsFromResponse(text)
}

function renderUserDrawingToBase64(strokes: Stroke[]): string {
  const SIZE = 512
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, { color: '#111827', dpr: 1 })
  }
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png').split(',')[1]
}

export async function analyzeStrokeAgainstImage(
  userStrokes: Stroke[],
  referenceImageBase64: string,
  referenceMediaType: SupportedMediaType,
  stepTitle: string,
  stepDescription: string,
): Promise<string> {
  try {
    const userDrawingBase64 = renderUserDrawingToBase64(userStrokes)
    const client = getClient()

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: referenceMediaType, data: referenceImageBase64 },
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: userDrawingBase64 },
            },
            {
              type: 'text',
              text: `Pierwsze zdjęcie: wzorzec (oryginalne zdjęcie).
Drugie zdjęcie: rysunek studenta wykonany dla kroku "${stepTitle}".
Opis kroku: "${stepDescription}"

Oceń w 2-3 zdaniach po polsku:
1. Czy student poprawnie wykonał ten krok? Co konkretnie jest dobrze lub źle?
2. Co powinien poprawić lub jak może to zrobić lepiej?

Bądź konkretny i pomocny. Porównuj rysunek studenta do wzorca.`,
            },
          ],
        },
      ],
    })

    const content = message.content[0]
    return content.type === 'text' ? content.text.trim() : 'Analiza niedostępna.'
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg === 'BRAK_KLUCZA') {
      return 'Brak klucza API. Utwórz plik .env.local z kluczem VITE_ANTHROPIC_API_KEY=sk-ant-...'
    }
    if (msg.includes('401') || msg.includes('authentication')) {
      return 'Nieprawidłowy klucz API Anthropic. Sprawdź plik .env.local.'
    }
    return 'Błąd połączenia z AI. Sprawdź klucz API i połączenie internetowe.'
  }
}
