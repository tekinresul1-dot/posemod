import { GoogleAuth } from 'google-auth-library'

const PROJECT = process.env.GOOGLE_PROJECT_ID ?? 'pixmarj'
const LOCATION = process.env.GOOGLE_LOCATION ?? 'us-central1'
const GENERATE_MODEL = 'imagen-4.0-generate-001'
const CUSTOMIZATION_MODEL = 'imagen-3.0-capability-001'

export interface GenerateParams {
  prompt: string
  negativePrompt?: string
  count: number
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  seed?: number
  /** Raw base64 strings (no data URI prefix) — product subject references */
  referenceImages?: string[]
  /** Raw base64 strings (no data URI prefix) — person/model subject references */
  personImages?: string[]
  /** Human-readable description injected into subjectImageConfig for product references */
  productSubjectDescription?: string
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_ATTEMPTS = 4
const BASE_DELAYS = [1000, 2500, 5000]
const RATE_LIMIT_DELAY_MS = 10_000

export async function generateImages(params: GenerateParams): Promise<Buffer[]> {
  const hasAnyRef = (params.referenceImages?.length ?? 0) + (params.personImages?.length ?? 0) > 0
  const model = hasAnyRef ? CUSTOMIZATION_MODEL : GENERATE_MODEL
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${model}:predict`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
      const token = await auth.getAccessToken()
      if (!token) throw new Error('Failed to obtain ADC access token')

      const instance: Record<string, unknown> = { prompt: params.prompt }

      const allRefs: Array<{ b64: string; type: 'product' | 'person' }> = [
        ...(params.referenceImages ?? []).map((b64) => ({ b64, type: 'product' as const })),
        ...(params.personImages ?? []).map((b64) => ({ b64, type: 'person' as const })),
      ]

      if (allRefs.length) {
        instance.referenceImages = allRefs.map(({ b64, type }, i) => ({
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: i + 1,
          referenceImage: { bytesBase64Encoded: b64 },
          subjectImageConfig: {
            subjectType: type === 'person' ? 'SUBJECT_TYPE_PERSON' : 'SUBJECT_TYPE_PRODUCT',
            ...(type === 'product' && params.productSubjectDescription
              ? { subjectDescription: params.productSubjectDescription }
              : {}),
          },
        }))
      }

      const body = {
        instances: [instance],
        parameters: {
          sampleCount: params.count,
          aspectRatio: params.aspectRatio ?? '9:16',
          ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
          ...(params.seed !== undefined ? { seed: params.seed } : {}),
          safetyFilterLevel: 'block_few',
          personGeneration: 'allow_adult',
          guidanceScale: hasAnyRef ? 25 : 12,
        },
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 429) {
        const errText = await res.text().catch(() => '')
        const err = new Error(`Vertex AI 429 rate-limited: ${errText}`)
        ;(err as Error & { status?: number }).status = 429
        throw err
      }

      if (res.status >= 500 && res.status < 600) {
        const errText = await res.text().catch(() => '')
        const err = new Error(`Vertex AI ${res.status}: ${errText}`)
        ;(err as Error & { status?: number }).status = res.status
        throw err
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Vertex AI ${res.status}: ${errText}`)
      }

      const data = await res.json() as { predictions?: { bytesBase64Encoded?: string }[] }
      const predictions = data.predictions ?? []
      if (predictions.length === 0) throw new Error('Vertex AI returned no predictions')

      return predictions.map((p) => {
        if (!p.bytesBase64Encoded) throw new Error('bytesBase64Encoded missing from prediction')
        return Buffer.from(p.bytesBase64Encoded, 'base64')
      })
    } catch (err) {
      const error = err as Error & { status?: number }
      lastError = error
      const isLast = attempt === MAX_ATTEMPTS - 1
      const isRateLimited = error.status === 429 || /429|rate.?limit|quota/i.test(error.message)
      const isRetryable = isRateLimited || (error.status !== undefined && error.status >= 500) || /network|timeout|fetch failed|ECONNRESET|ETIMEDOUT/i.test(error.message)

      if (isLast || !isRetryable) {
        throw error
      }

      const delay = isRateLimited
        ? RATE_LIMIT_DELAY_MS
        : BASE_DELAYS[Math.min(attempt, BASE_DELAYS.length - 1)]

      console.warn(`[imagen] Attempt ${attempt + 1} failed (${error.message}). Retrying in ${delay}ms...`)
      await sleep(delay)
    }
  }

  throw lastError ?? new Error('generateImages: unreachable')
}
