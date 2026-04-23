import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_COSTS, reserveCredits } from '@/lib/credits'
import { generationQueue } from '@/lib/queue'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevGeneration, getDevMannequins } from '@/lib/devStore'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

async function writeDataUriToDisk(jobId: string, dataUri: string, filename: string): Promise<string | null> {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const dir = path.join(process.cwd(), 'public', 'generations', jobId)
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, Buffer.from(match[2], 'base64'))
  return filePath
}

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
        if (!reserved) return Response.json({ error: 'Yetersiz kredi' }, { status: 402 })
      }

      const jobId = crypto.randomUUID()

      const productFilePath = await writeDataUriToDisk(jobId, productImageBase64, 'product-1.jpg')
      const backgroundFilePath = backgroundImageBase64
        ? await writeDataUriToDisk(jobId, backgroundImageBase64, 'background.jpg')
        : null
      const mannequinReferenceFilePath =
        mannequin.referencePhotoUrl && mannequin.referencePhotoUrl.startsWith('data:')
          ? await writeDataUriToDisk(jobId, mannequin.referencePhotoUrl, 'mannequin-ref.jpg')
          : null

      const savedInputUrls: string[] = []
      if (productFilePath) savedInputUrls.push(`/generations/${jobId}/product-1.jpg`)
      if (backgroundFilePath) savedInputUrls.push(`/generations/${jobId}/background.jpg`)

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
        if (!reserved) return Response.json({ error: 'Yetersiz kredi' }, { status: 402 })
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
        return Response.json({ error: 'Yetersiz kredi' }, { status: 402 })
      }
    }

    const jobId = crypto.randomUUID()

    const referenceFilePaths: string[] = []
    const savedInputUrls: string[] = []

    if (inputUrls.length > 0) {
      const dir = path.join(process.cwd(), 'public', 'generations', jobId)
      await fs.mkdir(dir, { recursive: true })

      for (let i = 0; i < inputUrls.length; i++) {
        const dataUri = inputUrls[i]
        if (!dataUri) continue
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/)
        if (!match) continue
        const ext = match[1].split('/')[1]?.replace(/\+.*/, '') || 'jpg'
        const filename = `input-${i + 1}.${ext}`
        const filePath = path.join(dir, filename)
        await fs.writeFile(filePath, Buffer.from(match[2], 'base64'))
        referenceFilePaths.push(filePath)
        savedInputUrls.push(`/generations/${jobId}/${filename}`)
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
    })

    return Response.json({ jobId })
  } catch (error) {
    return Response.json(
      { error: getPublicErrorMessage(error, 'Görsel üretimi başlatılamadı') },
      { status: getErrorStatus(error) }
    )
  }
}
