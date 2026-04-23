import fs from 'fs'
import fsp from 'fs/promises'
import type { Job } from 'bullmq'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { generateProductPose } from '@/lib/nanoBanana'
import { generateImages } from '@/lib/imagen'
import { saveImage } from '@/lib/storage'
import { confirmUsage, refundCredits } from '@/lib/credits'
import {
  GLOBAL_NEGATIVE_PROMPT,
  NEGATIVE_REALISM,
  HUMAN_REALISM_SUFFIX_EN,
  HUMAN_REALISM_SUFFIX_TR,
  getCompositionRule,
} from '@/lib/prompts'
import sharp from 'sharp'
import { isDatabaseUnavailable } from '@/lib/database'
import { updateDevGeneration } from '@/lib/devStore'

const LOG_FILE = '/tmp/worker.log'

function wlog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

interface QuickSetRevisionJobData {
  jobId: string
  userId: string
  productName: string
  quality: string
  revisionPrompt: string
  sourceImageUrl: string
  parentGenerationId: string
  creditCost: number
  width?: number | null
  height?: number | null
  aspectRatio?: string | null
  language?: string
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

async function fetchImageAsBase64(url: string): Promise<string | null> {
  // Try reading from local disk first (faster, avoids network for local files)
  if (url.startsWith('/generations/')) {
    try {
      const filePath = path.join(process.cwd(), 'public', url)
      const buf = await fsp.readFile(filePath)
      return buf.toString('base64')
    } catch {
      // fall through to HTTP fetch
    }
  }

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`
    const res = await fetch(fullUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.toString('base64')
  } catch {
    return null
  }
}

export async function processQuickSetRevision(job: Job<QuickSetRevisionJobData>) {
  const {
    jobId,
    userId,
    productName,
    revisionPrompt,
    sourceImageUrl,
    creditCost,
  } = job.data

  const language = job.data.language ?? 'tr'
  const quality = job.data.quality ?? '1k'
  const targetWidth = job.data.width && job.data.width > 0 ? job.data.width : 1024
  const targetHeight = job.data.height && job.data.height > 0 ? job.data.height : 1536
  const targetAspectRatio = (job.data.aspectRatio as '1:1' | '3:4' | '4:3' | '16:9' | '9:16') ?? '9:16'
  const jpegQuality = 90

  wlog(`Revision job ID: ${jobId}`)

  try {
    await markGeneration(jobId, { status: 'processing' })
  } catch {
    // Swallow devStore init errors
  }

  const sourceBase64 = await fetchImageAsBase64(sourceImageUrl)
  if (!sourceBase64) {
    await markGeneration(jobId, { status: 'failed', errorMsg: 'Kaynak görsel okunamadı' })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    wlog(`${jobId} failed — could not load source image`)
    return
  }

  const realismSuffix = language === 'tr' ? HUMAN_REALISM_SUFFIX_TR : HUMAN_REALISM_SUFFIX_EN
  const compositionRule = getCompositionRule(targetWidth, targetHeight)

  const finalPrompt =
    `Edit this reference image.\n` +
    `Apply the following revision: ${revisionPrompt}\n` +
    `Product: ${productName} — keep the product identical, same color, pattern, fabric, design.\n` +
    `Keep the same model identity and face if visible in reference.\n` +
    `Composition: ${compositionRule}\n` +
    `Output dimensions: ${targetWidth}x${targetHeight} pixels.\n` +
    `Professional e-commerce photography, clean background, soft studio lighting.\n` +
    `Ultra sharp, high quality, no noise, no blur, no distortion.\n` +
    `Product must be fully visible with no cropping.\n` +
    realismSuffix

  const finalNegative = `${GLOBAL_NEGATIVE_PROMPT}, ${NEGATIVE_REALISM}`

  wlog(`Revision prompt: ${finalPrompt.slice(0, 200)}...`)

  let outputBuf: Buffer | null = null

  try {
    // Try nanoBanana first (handles reference image natively)
    outputBuf = await generateProductPose({
      productImageBase64: sourceBase64,
      posePrompt: finalPrompt,
    })
  } catch (err) {
    wlog(`nanoBanana failed, falling back to Imagen: ${(err as Error).message}`)
    try {
      const results = await generateImages({
        prompt: finalPrompt,
        negativePrompt: finalNegative,
        count: 1,
        aspectRatio: targetAspectRatio,
        referenceImages: [sourceBase64],
      })
      outputBuf = results[0] ?? null
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2)
      wlog(`Generation failed: ${msg}`)
      await markGeneration(jobId, { status: 'failed', errorMsg: msg })
      if (process.env.SKIP_CREDIT_CHECK !== 'true') {
        await refundCredits(userId, creditCost, jobId)
      }
      return
    }
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
  } catch (err) {
    wlog(`Sharp resize failed (using original): ${err instanceof Error ? err.message : String(err)}`)
  }

  const url = await saveImage(outputBuf, jobId, 1)

  const generation = await (async () => {
    try {
      return await prisma.generation.update({
        where: { jobId },
        data: { status: 'completed', outputUrls: [url], completedAt: new Date() },
      })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return updateDevGeneration(jobId, (current) => ({
          ...current,
          status: 'completed',
          outputUrls: [url],
          completedAt: new Date(),
        }))
      }
      throw error
    }
  })()

  if (process.env.SKIP_CREDIT_CHECK !== 'true') {
    await confirmUsage(userId, creditCost, generation.id)
  }
  wlog(`${jobId} completed — revision saved: ${url}`)
}
