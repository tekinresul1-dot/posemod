import fs from 'fs'
import type { Job } from 'bullmq'
import { promises as fsp } from 'fs'
import { prisma } from '@/lib/prisma'
import { generateProductPose } from '@/lib/nanoBanana'
import { generateImages } from '@/lib/imagen'
import { saveImage } from '@/lib/storage'
import { confirmUsage, refundCredits } from '@/lib/credits'
import { GLOBAL_NEGATIVE_PROMPT, NEGATIVE_REALISM, HUMAN_REALISM_SUFFIX_EN, HUMAN_REALISM_SUFFIX_TR, getCompositionRule } from '@/lib/prompts'
import sharp from 'sharp'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevGeneration, updateDevGeneration } from '@/lib/devStore'

const LOG_FILE = '/tmp/worker.log'

function wlog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

interface QuickSetJobData {
  jobId: string
  userId: string
  productName: string
  quality: string
  prompt?: string
  referenceFilePaths?: string[]
  creditCost: number
  width?: number | null
  height?: number | null
  aspectRatio?: string | null
  language?: string
}

async function loadReferenceImages(filePaths: string[]): Promise<string[]> {
  const results: string[] = []
  for (const fp of filePaths) {
    try {
      const buf = await fsp.readFile(fp)
      results.push(buf.toString('base64'))
    } catch {
      wlog(`Could not read reference image: ${fp}`)
    }
  }
  return results
}

async function markGeneration(jobId: string, data: Record<string, unknown>) {
  try {
    await prisma.generation.update({ where: { jobId }, data })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await updateDevGeneration(jobId, (gen) => ({ ...gen, ...data }))
      return
    }
    throw error
  }
}

export async function processQuickSet(job: Job<QuickSetJobData>) {
  const { jobId, userId, productName, creditCost, referenceFilePaths = [] } = job.data
  const customPrompt = job.data.prompt
  const jobType = job.name
  const language = job.data.language ?? 'tr'
  const quality = job.data.quality ?? '1k'
  const targetWidth = job.data.width && job.data.width > 0 ? job.data.width : 1024
  const targetHeight = job.data.height && job.data.height > 0 ? job.data.height : 1536
  const targetAspectRatio = (job.data.aspectRatio as '1:1' | '3:4' | '4:3' | '16:9' | '9:16') ?? '9:16'
  const realismSuffix = language === 'tr' ? HUMAN_REALISM_SUFFIX_TR : HUMAN_REALISM_SUFFIX_EN
  const finalNegative = `${GLOBAL_NEGATIVE_PROMPT}, ${NEGATIVE_REALISM}`
  const jpegQuality = 90

  wlog(`Job ID: ${jobId}`)
  wlog(`Type: ${jobType}`)

  try {
    await markGeneration(jobId, { status: 'processing' })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await createDevGeneration({
        userId,
        jobId,
        type: jobType,
        status: 'processing',
        creditCost,
        productName,
        prompt: customPrompt ?? null,
        negPrompt: null,
        quality: job.data.quality,
        inputUrls: [],
        outputUrls: [],
        mannequinId: null,
        errorMsg: null,
        parentGenerationId: null,
      })
    } else {
      throw error
    }
  }

  const referenceImages = await loadReferenceImages(referenceFilePaths)
  const hasRef = referenceImages.length > 0

  wlog(`Reference image: ${hasRef ? `YES (base64 length: ${referenceImages[0]?.length ?? 0})` : 'NO'}`)
  wlog(`Mannequin ref: NO`)
  wlog(`Background ref: NO`)

  const compositionRule = getCompositionRule(targetWidth, targetHeight)
  const basePrompt = customPrompt
    ? `${customPrompt}\n` +
      (hasRef ? `Keep the exact product from the reference image: identical color, pattern, fabric, design and all details.\n` : '')
    : `Professional e-commerce product photography of ${productName}.\n` +
      (hasRef ? `Keep this exact product identical: same color, pattern, fabric, design, details.\n` : '') +
      `Pure white studio background, soft lighting.`

  const finalPrompt = `${basePrompt}
Composition: ${compositionRule}
Output dimensions: ${targetWidth}x${targetHeight} pixels.
Professional e-commerce photography, clean background, soft studio lighting.
Ultra sharp, high quality, no noise, no blur, no distortion.
Product must be fully visible with no cropping.
${realismSuffix}`

  wlog(`Prompt: ${finalPrompt}`)

  let outputBuf: Buffer | null = null

  try {
    if (hasRef && referenceImages[0]) {
      outputBuf = await generateProductPose({
        productImageBase64: referenceImages[0],
        posePrompt: finalPrompt,
      })
    } else {
      const results = await generateImages({
        prompt: finalPrompt,
        negativePrompt: finalNegative,
        count: 1,
        aspectRatio: targetAspectRatio,
      })
      outputBuf = results[0] ?? null
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    wlog(`Generation failed: ${msg}`)
    await markGeneration(jobId, { status: 'failed', errorMsg: msg })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    return
  }

  if (!outputBuf) {
    await markGeneration(jobId, { status: 'failed', errorMsg: 'Görsel üretimi başarısız' })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    wlog(`${jobId} failed — no image produced`)
    return
  }

  try {
    outputBuf = await sharp(outputBuf)
      .resize(targetWidth, targetHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .jpeg({ quality: jpegQuality })
      .toBuffer()
    wlog(`Resized to ${targetWidth}x${targetHeight} (jpeg quality: ${jpegQuality})`)
  } catch (err) {
    wlog(`Sharp resize failed (using original): ${err instanceof Error ? err.message : String(err)}`)
  }

  const url = await saveImage(outputBuf, jobId, 1)
  const outputUrls = [url]

  const generation = await (async () => {
    try {
      return await prisma.generation.update({
        where: { jobId },
        data: { status: 'completed', outputUrls, completedAt: new Date() },
      })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return updateDevGeneration(jobId, (current) => ({
          ...current,
          status: 'completed',
          outputUrls,
          completedAt: new Date(),
        }))
      }
      throw error
    }
  })()

  if (process.env.SKIP_CREDIT_CHECK !== 'true') {
    await confirmUsage(userId, creditCost, generation.id)
  }
  wlog(`${jobId} completed — image saved: ${url}`)
}
