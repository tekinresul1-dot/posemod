import fs from 'fs'
import { GoogleAuth } from 'google-auth-library'
import { generateImages as imagenFallback } from './imagen'
import type { GenerateParams } from './imagen'

const PROJECT = process.env.GOOGLE_PROJECT_ID ?? 'pixmarj'
const LOCATION = process.env.GOOGLE_LOCATION ?? 'us-central1'
const LOG_FILE = '/tmp/worker.log'

const MODELS = [
  { name: 'Nano Banana Pro', id: 'gemini-3-pro-image-preview' },
  { name: 'Nano Banana 2', id: 'gemini-3.1-flash-image-preview' },
  { name: 'Nano Banana', id: 'gemini-2.5-flash-image' },
]

function modelEndpoint(modelId: string): string {
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${modelId}:generateContent`
}

export function wlog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface NanoBananaParams {
  prompt: string
  productImageBase64: string
  mannequinImageBase64?: string
  aspectRatio?: '9:16' | '1:1' | '16:9' | '3:4' | '4:3'
}

export async function generateWithNanaBanana(
  params: NanoBananaParams,
): Promise<{ buffer: Buffer; modelName: string }> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const token = await auth.getAccessToken()
  if (!token) throw new Error('Failed to obtain ADC access token')

  const parts: unknown[] = [
    { inlineData: { mimeType: 'image/jpeg', data: params.productImageBase64 } },
  ]
  if (params.mannequinImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: params.mannequinImageBase64 } })
  }
  parts.push({ text: params.prompt })

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.4,
    },
  }

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const model = MODELS[modelIdx]!
    const endpoint = modelEndpoint(model.id)
    wlog(`Model: ${model.name} (${model.id})`)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const isFallbackError = res.status === 429 || res.status === 403 || res.status === 404
        if (isFallbackError) {
          const text = await res.text()
          const err = new Error(`${model.name} ${res.status}: ${text.slice(0, 200)}`)
          ;(err as Error & { status?: number }).status = res.status
          wlog(`API Response: error (status ${res.status}) — falling back to next model`)
          throw err
        }
        if (res.status >= 500) {
          const err = new Error(`${model.name} ${res.status}`)
          ;(err as Error & { status?: number }).status = res.status
          throw err
        }
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`${model.name} ${res.status}: ${text.slice(0, 200)}`)
        }

        const data = await res.json() as {
          candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[]
        }
        const allParts = data.candidates?.[0]?.content?.parts ?? []
        const b64 = allParts.find((p) => p.inlineData?.data)?.inlineData?.data
        if (!b64) throw new Error(`${model.name} returned no image data`)

        wlog(`API Response: success`)
        const buffer = Buffer.from(b64, 'base64')
        wlog(`Generated image: YES (size: ${Math.round(buffer.length / 1024)} KB)`)
        return { buffer, modelName: model.name }
      } catch (err) {
        const error = err as Error & { status?: number }
        lastError = error
        const isFallbackTrigger =
          error.status === 429 || error.status === 403 || error.status === 404
        if (isFallbackTrigger) break
        const isLast = attempt === 3
        const isRetryable =
          (error.status !== undefined && error.status >= 500) ||
          /network|timeout|fetch failed|ECONNRESET/i.test(error.message)
        if (isLast || !isRetryable) break
        const delay = [1000, 2500, 5000][attempt] ?? 5000
        wlog(`${model.name} attempt ${attempt + 1} failed. Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }

    if (modelIdx < MODELS.length - 1) {
      wlog(`${model.name} failed (${lastError?.message ?? 'unknown'}), trying next model...`)
    }
  }

  wlog(`API Response: error — all models exhausted`)
  throw new Error('All models failed in generateWithNanaBanana')
}

export async function generateMannequinPose(params: {
  productImageBase64: string
  mannequinImageBase64?: string
  poseDescription: string
  productLabel: string
  mannequinPrompt: string
  backgroundClause: string
  realismSuffix?: string
}): Promise<Buffer> {
  const { productImageBase64, mannequinImageBase64, poseDescription, mannequinPrompt, backgroundClause, realismSuffix } = params

  const prompt =
    `Put the exact garment from the reference image on the model.\n` +
    `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
    `Model: ${mannequinPrompt}\n` +
    `Pose: ${poseDescription}\n` +
    `Background: ${backgroundClause}\n` +
    `Professional fashion photography, 9:16 portrait ratio, 8k quality.` +
    (realismSuffix ? `\n${realismSuffix}` : '')

  try {
    const { buffer } = await generateWithNanaBanana({
      prompt,
      productImageBase64,
      mannequinImageBase64,
      aspectRatio: '9:16',
    })
    return buffer
  } catch (err) {
    wlog(`generateMannequinPose failed, falling back to Imagen: ${(err as Error).message}`)
    const imagenParams: GenerateParams = {
      prompt,
      count: 1,
      aspectRatio: '9:16',
      referenceImages: [productImageBase64],
      personImages: mannequinImageBase64 ? [mannequinImageBase64] : undefined,
    }
    const buffers = await imagenFallback(imagenParams)
    return buffers[0]
  }
}

export async function generateProductPose(params: {
  productImageBase64: string
  posePrompt: string
}): Promise<Buffer> {
  try {
    const { buffer } = await generateWithNanaBanana({
      prompt: params.posePrompt,
      productImageBase64: params.productImageBase64,
      aspectRatio: '9:16',
    })
    return buffer
  } catch (err) {
    wlog(`generateProductPose failed, falling back to Imagen: ${(err as Error).message}`)
    const buffers = await imagenFallback({
      prompt: params.posePrompt,
      count: 1,
      aspectRatio: '9:16',
      referenceImages: [params.productImageBase64],
    })
    return buffers[0]
  }
}
