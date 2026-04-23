import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'

const ANALYSIS_PROMPT =
  "Analyze this fashion model photo. Extract and return JSON only with these fields: " +
  "{gender, ageRange, skinTone, hairColor, hairLength, eyeColor, ethnicity, height, size, additionalFeatures}. " +
  "For gender use 'Kadın' or 'Erkek'. For ageRange use '18-25', '25-35', or '35-45'. " +
  "For skinTone use 'Açık', 'Orta', 'Koyu', or 'Esmer'. " +
  "For hairColor use 'Siyah', 'Kahverengi', 'Sarı', 'Kızıl', or 'Gri'. " +
  "For hairLength use 'Kısa', 'Orta', or 'Uzun'. " +
  "For eyeColor use 'Kahverengi', 'Yeşil', 'Mavi', or 'Siyah'. " +
  "For ethnicity use 'Türk', 'Avrupalı', 'Orta Doğu', 'Afrikalı', 'Asyalı', or 'Latin'. " +
  "For height use format like '170cm'. For size use 'XS', 'S', 'M', 'L', or 'XL'."

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as { imageBase64?: string }
    const imageBase64 = body.imageBase64
    if (!imageBase64) {
      return Response.json({})
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return Response.json({})
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '')

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      return Response.json({})
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({})

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return Response.json(parsed)
    } catch {
      return Response.json({})
    }
  } catch {
    return Response.json({})
  }
}
