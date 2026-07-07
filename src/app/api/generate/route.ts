import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_COSTS, reserveCredits } from '@/lib/credits'
import { generationQueue } from '@/lib/queue'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevGeneration, getDevMannequins } from '@/lib/devStore'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'
import { parseDataUri, validateText } from '@/lib/validation'
import { saveInputImage } from '@/lib/storage'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

async function persistDataUri(jobId: string, dataUri: string, fallbackName: string): Promise<string | null> {
  const parsed = parseDataUri(dataUri)
  if (!parsed) return null
  const filename = `${fallbackName}.${parsed.ext}`
  return saveInputImage(parsed.buffer, jobId, filename, parsed.mimeType)
}

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const limit = await checkRateLimit({
    key: `generation:${user.id}:${clientIp(request)}`,
    limit: 30,
    windowSeconds: 60 * 60,
  })
  if (!limit.ok) return Response.json({ error: 'Çok fazla üretim denemesi. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })

  try {
    const body = await request.json() as {
      type: string
      productName: string
      quality: string
      mannequinId?: string
      prompt?: string
      inputUrls?: string[]
      productImageBase64?: string
      backgroundImageBase64?: string | null
      selectedPoses?: string[]
      width?: number
      height?: number
      aspectRatio?: string
      language?: string
      // revision-specific
      sourceImageUrl?: string
      revisionPrompt?: string
      sourceGenerationId?: string
    }

    const {
      type,
      productName,
      quality,
      mannequinId,
      prompt,
      inputUrls = [],
      productImageBase64,
      backgroundImageBase64,
      selectedPoses = [],
      width,
      height,
      aspectRatio,
      language = 'tr',
      sourceImageUrl,
      revisionPrompt,
      sourceGenerationId,
    } = body

    if (!type || !validateText(productName || prompt || revisionPrompt || 'generation', 2000)) {
      return Response.json({ error: 'Üretim açıklaması gerekli' }, { status: 400 })
    }

    if (type === 'mannequin') {
      if (!mannequinId) return Response.json({ error: 'Manken gerekli' }, { status: 400 })
      if (!productImageBase64) return Response.json({ error: 'Ürün görseli gerekli' }, { status: 400 })
      if (!selectedPoses.length) return Response.json({ error: 'En az bir poz seçin' }, { status: 400 })

      const mannequin = await (async () => {
        try {
          return await prisma.mannequin.findUnique({ where: { id: mannequinId } })
        } catch (error) {
          if (isDatabaseUnavailable(error)) {
            const devMannequins = await getDevMannequins()
            return devMannequins.find((m) => m.id === mannequinId) ?? null
          }
          throw error
        }
      })()
      if (!mannequin) return Response.json({ error: 'Manken bulunamadı' }, { status: 404 })
      if (mannequin.userId !== user.id && !mannequin.isSystem) {
        return Response.json({ error: 'Bu mankene erişim yok' }, { status: 403 })
      }

      const baseCost = selectedPoses.length * 1.0
      let creditCost = baseCost
      if (quality === '2k') creditCost += CREDIT_COSTS.quality_2k
      if (quality === '4k') creditCost += CREDIT_COSTS.quality_4k

      if (process.env.SKIP_CREDIT_CHECK !== 'true') {
        const reserved = await reserveCredits(user.id, creditCost)
        if (!reserved) return Response.json({ error: 'Yetersiz kredi. Devam etmek için kredi satın alın.' }, { status: 402 })
      }

      const jobId = crypto.randomUUID()

      const productFilePath = await persistDataUri(jobId, productImageBase64, 'product-1')
      const backgroundFilePath = backgroundImageBase64
        ? await persistDataUri(jobId, backgroundImageBase64, 'background')
        : null
      const mannequinReferenceFilePath =
        mannequin.referencePhotoUrl && mannequin.referencePhotoUrl.startsWith('data:')
          ? await persistDataUri(jobId, mannequin.referencePhotoUrl, 'mannequin-ref')
          : null

      const savedInputUrls: string[] = []
      if (productFilePath) savedInputUrls.push(productFilePath.startsWith('/') ? `/generations/${jobId}/product-1.jpg` : productFilePath)
      if (backgroundFilePath) savedInputUrls.push(backgroundFilePath.startsWith('/') ? `/generations/${jobId}/background.jpg` : backgroundFilePath)

      const generationData = {
        userId: user.id,
        jobId,
        type: 'mannequin',
        creditCost,
        productName,
        prompt: mannequin.prompt,
        quality,
        inputUrls: savedInputUrls,
        mannequinId,
        outputUrls: [],
        status: 'pending',
        negPrompt: null,
        errorMsg: null,
        parentGenerationId: null,
      }

      try {
        const { parentGenerationId: _pid, ...prismaData } = generationData
        await prisma.generation.create({ data: prismaData })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          await createDevGeneration(generationData)
        } else {
          throw error
        }
      }

      await generationQueue.add('mannequin', {
        jobId,
        userId: user.id,
        productName,
        quality,
        mannequinId,
        mannequinPrompt: mannequin.prompt,
        poseData: mannequin.poseData,
        selectedPoses,
        productFilePath,
        backgroundFilePath,
        mannequinReferenceFilePath,
        hasBackground: Boolean(backgroundFilePath),
        creditCost,
        language,
      }, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      })

      return Response.json({ jobId })
    }

    if (type === 'quick_set_revision') {
      if (!sourceImageUrl) return Response.json({ error: 'Kaynak görsel gerekli' }, { status: 400 })
      if (!revisionPrompt) return Response.json({ error: 'Revize açıklaması gerekli' }, { status: 400 })

      let creditCost = CREDIT_COSTS.quick_set_revision ?? 0.1
      if (quality === '2k') creditCost = CREDIT_COSTS.quick_set_revision_2k ?? 0.3
      if (quality === '4k') creditCost = CREDIT_COSTS.quick_set_revision_4k ?? 0.5

      if (process.env.SKIP_CREDIT_CHECK !== 'true') {
        const reserved = await reserveCredits(user.id, creditCost)
        if (!reserved) return Response.json({ error: 'Yetersiz kredi. Devam etmek için kredi satın alın.' }, { status: 402 })
      }

      const jobId = crypto.randomUUID()

      const generationData = {
        userId: user.id,
        jobId,
        type: 'quick_set_revision',
        creditCost,
        productName,
        prompt: revisionPrompt,
        quality,
        inputUrls: [sourceImageUrl],
        mannequinId: null,
        outputUrls: [],
        status: 'pending',
        negPrompt: null,
        errorMsg: null,
        parentGenerationId: sourceGenerationId ?? null,
      }

      try {
        const { parentGenerationId: _pid, ...prismaData } = generationData
        await prisma.generation.create({ data: prismaData })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          await createDevGeneration(generationData)
        } else {
          throw error
        }
      }

      await generationQueue.add('quick_set_revision', {
        jobId,
        userId: user.id,
        productName,
        quality,
        revisionPrompt,
        sourceImageUrl,
        parentGenerationId: sourceGenerationId ?? null,
        creditCost,
        width: width ?? null,
        height: height ?? null,
        aspectRatio: aspectRatio ?? null,
        language,
      }, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      })

      return Response.json({ jobId })
    }

    let creditCost: number
    if (type === 'quick_set') {
      creditCost = quality === '4k'
        ? (CREDIT_COSTS.quick_set_4k ?? 0.5)
        : quality === '2k'
        ? (CREDIT_COSTS.quick_set_2k ?? 0.3)
        : (CREDIT_COSTS.quick_set ?? 0.1)
    } else {
      creditCost = CREDIT_COSTS[type] ?? 1.0
      if (quality === '2k') creditCost += CREDIT_COSTS.quality_2k ?? 0
      if (quality === '4k') creditCost += CREDIT_COSTS.quality_4k ?? 0
    }

    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      const reserved = await reserveCredits(user.id, creditCost)
      if (!reserved) {
        return Response.json({ error: 'Yetersiz kredi. Devam etmek için kredi satın alın.' }, { status: 402 })
      }
    }

    const jobId = crypto.randomUUID()

    const referenceFilePaths: string[] = []
    const savedInputUrls: string[] = []

    if (inputUrls.length > 0) {
      for (let i = 0; i < inputUrls.length; i++) {
        const dataUri = inputUrls[i]
        if (!dataUri) continue
        const parsed = parseDataUri(dataUri)
        if (!parsed) {
          return Response.json({ error: 'Sadece jpg, png veya webp ve en fazla 10MB görsel yükleyin' }, { status: 400 })
        }
        const location = await saveInputImage(
          parsed.buffer,
          jobId,
          `input-${i + 1}.${parsed.ext}`,
          parsed.mimeType
        )
        referenceFilePaths.push(location)
        savedInputUrls.push(location.startsWith('/') ? `/generations/${jobId}/input-${i + 1}.${parsed.ext}` : location)
      }
    }

    const generationData = {
      userId: user.id,
      jobId,
      type,
      creditCost,
      productName,
      prompt: prompt ?? null,
      quality,
      inputUrls: savedInputUrls,
      mannequinId: mannequinId ?? null,
      outputUrls: [],
      status: 'pending',
      negPrompt: null,
      errorMsg: null,
      parentGenerationId: null,
    }

    try {
      const { parentGenerationId: _pid, ...prismaData } = generationData
      await prisma.generation.create({ data: prismaData })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        await createDevGeneration(generationData)
      } else {
        throw error
      }
    }

    await generationQueue.add(type, {
      jobId,
      userId: user.id,
      productName,
      quality,
      mannequinId,
      prompt,
      referenceFilePaths,
      creditCost,
      width: width ?? null,
      height: height ?? null,
      aspectRatio: aspectRatio ?? null,
      language,
    }, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    })

    return Response.json({ jobId })
  } catch (error) {
    return Response.json(
      { error: getPublicErrorMessage(error, 'Görsel üretimi başlatılamadı') },
      { status: getErrorStatus(error) }
    )
  }
}
