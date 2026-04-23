import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { generateImages } from '@/lib/imagen'
import { saveImage } from '@/lib/storage'

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { prompt } = await request.json() as { prompt?: string }
    const isMock = !process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'buraya_api_key_yaz'

    const buffers = await generateImages({
      prompt: prompt ?? 'Professional product photo of a red sneaker, white background, studio lighting',
      count: 1,
      aspectRatio: '1:1',
    })

    const jobId = `test-${crypto.randomUUID()}`
    const url = await saveImage(buffers[0], jobId, 1)

    return Response.json({
      success: true,
      url,
      bytes: buffers[0].length,
      mock: isMock,
      message: isMock
        ? 'Mock mode (picsum.photos) — set GOOGLE_API_KEY in .env.local for real Imagen'
        : 'Real Imagen API',
    })
  } catch (err) {
    return Response.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
