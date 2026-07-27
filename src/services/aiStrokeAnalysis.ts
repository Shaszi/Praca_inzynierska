import Anthropic from '@anthropic-ai/sdk'
import type { Stroke } from '../types/drawing'

function getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('BRAK_KLUCZA')
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function renderComparisonImage(userStroke: Stroke, referenceStroke: Stroke | null): string {
  const SIZE = 512
  const PADDING = 60
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const allPoints = [...userStroke.points, ...(referenceStroke?.points ?? [])]
  if (allPoints.length === 0) return canvas.toDataURL('image/png').split(',')[1]

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const rangeX = Math.max(maxX - minX, 1)
  const rangeY = Math.max(maxY - minY, 1)
  const drawArea = SIZE - 2 * PADDING
  const scale = Math.min(drawArea / rangeX, drawArea / rangeY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const toXY = (x: number, y: number) => ({
    sx: SIZE / 2 + (x - cx) * scale,
    sy: SIZE / 2 + (y - cy) * scale,
  })

  const paintStroke = (stroke: Stroke, color: string, alpha: number, dashed: boolean) => {
    if (stroke.points.length === 0) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(4, stroke.brushSize * scale * 0.35)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (dashed) ctx.setLineDash([14, 8])

    if (stroke.points.length === 1) {
      const { sx, sy } = toXY(stroke.points[0].x, stroke.points[0].y)
      ctx.beginPath()
      ctx.arc(sx, sy, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      const { sx: x0, sy: y0 } = toXY(stroke.points[0].x, stroke.points[0].y)
      ctx.moveTo(x0, y0)
      for (let i = 1; i < stroke.points.length; i++) {
        const { sx, sy } = toXY(stroke.points[i].x, stroke.points[i].y)
        ctx.lineTo(sx, sy)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  if (referenceStroke) paintStroke(referenceStroke, '#2563eb', 0.65, true)
  paintStroke(userStroke, '#111827', 1, false)

  // Legend
  ctx.save()
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#2563eb'
  ctx.globalAlpha = 0.85
  ctx.fillText('- - wzorzec', 12, 24)
  ctx.fillStyle = '#111827'
  ctx.globalAlpha = 1
  ctx.fillText('— kreska studenta', 12, 46)
  ctx.restore()

  return canvas.toDataURL('image/png').split(',')[1]
}

export async function analyzeDrawingStroke(
  userStroke: Stroke,
  referenceStroke: Stroke | null,
): Promise<string> {
  try {
    const imageData = renderComparisonImage(userStroke, referenceStroke)
    const client = getClient()

    const prompt = referenceStroke
      ? `Jesteś doświadczonym instruktorem rysunku technicznego.

Na obrazie:
• Niebieska przerywana linia = wzorzec (co student miał narysować)
• Czarna ciągła linia = kreska narysowana przez studenta

Przeanalizuj PRECYZYJNIE różnice między kreską studenta a wzorcem. Napisz 2-3 zdania po polsku:
1. Oceń kształt i proporcje (np. "Okrąg jest owalem - za bardzo rozciągnięty poziomo o ~30%", "Linia odchyla się o ~15° w prawo", "Krzywa ma za ostry łuk w górnej części")
2. Powiedz co konkretnie student powinien zmienić

Bądź bezpośredni i rzeczowy. Jeśli kreska jest dobra - powiedz to. Jeśli są problemy - opisz je precyzyjnie.`
      : `Jesteś instruktorem rysunku. Oceń jakość swobodnej kreski studenta (czarna linia) w 2 zdaniach po polsku. Zwróć uwagę na: pewność ręki, płynność, równomierność grubości linii.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
            { type: 'text', text: prompt },
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
      return 'Nieprawidłowy klucz API Anthropic. Sprawdź VITE_ANTHROPIC_API_KEY w pliku .env.local'
    }
    return 'Błąd połączenia z AI. Sprawdź klucz API i połączenie internetowe.'
  }
}
