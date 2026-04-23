import fs from 'fs'
import type { Job } from 'bullmq'
import { promises as fsp } from 'fs'
import { prisma } from '@/lib/prisma'
import { generateMannequinPose } from '@/lib/nanoBanana'
import { saveImage } from '@/lib/storage'
import { confirmUsage, refundCredits } from '@/lib/credits'
import { MANNEQUIN_SET_POSES } from '@/lib/prompts'

const LOG_FILE = '/tmp/worker.log'

function wlog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

interface MannequinSetJobData {
  jobId: string
  userId: string
  productName: string
  quality: string
  mannequinId: string
  prompt?: string
  referenceFilePaths?: string[]
  creditCost: number
}

async function loadFileAsBase64(filePath: string | null): Promise<string | null> {
  if (!filePath) return null
  try {
    const buf = await fsp.readFile(filePath)
    return buf.toString('base64')
  } catch {
    return null
  }
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

async function loadDataUriAsBase64(dataUri: string | null | undefined): Promise<string | null> {
  if (!dataUri) return null
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/)
  if (match) return match[1]!
  return null
}

export async function processMannequinSet(job: Job<MannequinSetJobData>) {
  const { jobId, userId, productName, mannequinId, creditCost, referenceFilePaths = [] } = job.data

  wlog(`Job ID: ${jobId}`)
  wlog(`Type: mannequin_set`)

  await prisma.generation.update({
    where: { jobId },
    data: { status: 'processing' },
  })

  const mannequin = await prisma.mannequin.findUnique({ where: { id: mannequinId } })
  if (!mannequin) {
    await prisma.generation.update({
      where: { jobId },
      data: { status: 'failed', errorMsg: 'Manken bulunamadı' },
    })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    return
  }

  const referenceImages = await loadReferenceImages(referenceFilePaths)
  const hasRef = referenceImages.length > 0
  const productBase64 = hasRef ? referenceImages[0]! : null

  const mannequinPersonBase64 = await loadDataUriAsBase64(mannequin.referencePhotoUrl)

  wlog(`Reference image: ${productBase64 ? `YES (base64 length: ${productBase64.length})` : 'NO'}`)
  wlog(`Mannequin ref: ${mannequinPersonBase64 ? `YES (base64 length: ${mannequinPersonBase64.length})` : 'NO'}`)
  wlog(`Background ref: NO`)

  if (!productBase64) {
    await prisma.generation.update({
      where: { jobId },
      data: { status: 'failed', errorMsg: 'Ürün görseli okunamadı' },
    })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    wlog(`${jobId} failed — no product reference image`)
    return
  }

  const backgroundClause = 'pure white studio'

  const results = await Promise.allSettled(
    MANNEQUIN_SET_POSES.map((pose, idx) => {
      const prompt = pose.build(mannequin.prompt, backgroundClause)
      wlog(`Pose ${idx + 1}/${MANNEQUIN_SET_POSES.length}: ${pose.name}`)
      wlog(`Prompt: ${prompt}`)
      return generateMannequinPose({
        productImageBase64: productBase64,
        mannequinImageBase64: mannequinPersonBase64 ?? undefined,
        poseDescription: pose.poseDesc,
        productLabel: productName,
        mannequinPrompt: mannequin.prompt,
        backgroundClause,
      }).then((buf) => [buf])
    })
  )

  const outputUrls: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled' && result.value.length > 0) {
      const url = await saveImage(result.value[0], jobId, i + 1)
      outputUrls.push(url)
    } else if (result.status === 'rejected') {
      wlog(`Pose ${i + 1} failed: ${result.reason?.message}`)
    }
  }

  if (outputUrls.length === 0) {
    await prisma.generation.update({
      where: { jobId },
      data: { status: 'failed', errorMsg: 'Tüm görsel üretimleri başarısız' },
    })
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    wlog(`${jobId} failed — all poses failed`)
    return
  }

  const generation = await prisma.generation.update({
    where: { jobId },
    data: { status: 'completed', outputUrls, completedAt: new Date() },
  })

  if (process.env.SKIP_CREDIT_CHECK !== 'true') {
    await confirmUsage(userId, creditCost, generation.id)
  }
  wlog(`${jobId} completed — ${outputUrls.length} images`)
}
