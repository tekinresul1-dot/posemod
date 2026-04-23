import fsSync from 'fs'
import type { Job } from 'bullmq'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { generateMannequinPose } from '@/lib/nanoBanana'
import { saveImage } from '@/lib/storage'
import { confirmUsage, refundCredits } from '@/lib/credits'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevGeneration, updateDevGeneration } from '@/lib/devStore'
import { HUMAN_REALISM_SUFFIX_EN, HUMAN_REALISM_SUFFIX_TR } from '@/lib/prompts'

const LOG_FILE = '/tmp/worker.log'

function wlog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fsSync.appendFileSync(LOG_FILE, line) } catch {}
}

interface MannequinJobData {
  jobId: string
  userId: string
  productName: string
  quality: string
  mannequinId: string
  mannequinPrompt: string
  poseData: Record<string, string> | null
  selectedPoses: string[]
  productFilePath: string | null
  backgroundFilePath: string | null
  mannequinReferenceFilePath: string | null
  hasBackground: boolean
  creditCost: number
  language?: string
}

const POSE_NAMES: Record<string, string> = {
  front: 'Ön - Tam Boy Dik Duruş',
  back: 'Arka - Ürün Arkası',
  right: 'Yürüyüş - Sağdan',
  left: 'Yürüyüş - Soldan',
  angle45right: 'Detay - Üst',
  angle45left: 'Detay - Alt',
}

const DEFAULT_POSE_DATA: Record<string, string> = {
  front: 'model standing straight facing camera, full body, product clearly visible from front',
  back: 'model facing away from camera, back of the product clearly visible, hair pulled to side',
  right: 'model walking pose turned slightly to show right side of product, dynamic fashion pose',
  left: 'model walking pose turned slightly to show left side of product, dynamic fashion pose',
  angle45right: 'close-up shot of upper body, product detail visible, fabric texture clear',
  angle45left: 'close-up shot of lower body and waist area, product bottom detail visible',
}

async function loadFileAsBase64(filePath: string | null): Promise<string | null> {
  if (!filePath) return null
  try {
    const buf = await fs.readFile(filePath)
    return buf.toString('base64')
  } catch {
    return null
  }
}

interface ProductAnalysis {
  type: string
  color: string
  pattern: string
  fabric: string
  details: {
    collar?: string
    buttons?: string
    pockets?: string
    length?: string
    sleeves?: string
    fit?: string
  }
  distinguishingFeatures: string[]
}

async function analyzeProduct(base64: string): Promise<{ description: string; subjectDescription: string }> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { description: '', subjectDescription: '' }
  try {
    const prompt =
      'Analyze this clothing product image in extreme detail. Return ONLY valid JSON:\n' +
      '{"type":"blazer/dress/shirt/pants/etc","color":"exact color with shade","pattern":"solid/striped/checked/plaid/etc",' +
      '"fabric":"wool/cotton/silk/etc","details":{"collar":"stand-up/notched/shawl/etc","buttons":"number color position",' +
      '"pockets":"number and type","length":"cropped/regular/long","sleeves":"long/short/3-4","fit":"slim/regular/oversized"},' +
      '"distinguishingFeatures":["unique detail 1","unique detail 2"]}'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: prompt }] }],
        }),
      }
    )
    if (!res.ok) return { description: '', subjectDescription: '' }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { description: '', subjectDescription: '' }
    const p: ProductAnalysis = JSON.parse(match[0])
    const details = [
      p.details.collar && `${p.details.collar} collar`,
      p.details.buttons && `${p.details.buttons}`,
      p.details.pockets && `${p.details.pockets}`,
      p.details.length && `${p.details.length} length`,
      p.details.sleeves && `${p.details.sleeves} sleeves`,
      p.details.fit && `${p.details.fit} fit`,
      ...(p.distinguishingFeatures ?? []),
    ].filter(Boolean).join(', ')
    const description = `${p.color} ${p.pattern !== 'solid' ? p.pattern + ' ' : ''}${p.fabric ? p.fabric + ' ' : ''}${p.type}${details ? ', ' + details : ''}`
    const subjectDescription = `${p.color} ${p.type} with ${details || 'exact design as shown'}`
    return { description, subjectDescription }
  } catch {
    return { description: '', subjectDescription: '' }
  }
}

export async function processMannequin(job: Job<MannequinJobData>) {
  const {
    jobId,
    userId,
    productName,
    quality,
    mannequinPrompt,
    poseData,
    selectedPoses,
    productFilePath,
    backgroundFilePath,
    mannequinReferenceFilePath,
    hasBackground,
    creditCost,
  } = job.data
  const language = job.data.language ?? 'tr'
  const realismSuffix = language === 'tr' ? HUMAN_REALISM_SUFFIX_TR : HUMAN_REALISM_SUFFIX_EN

  wlog(`Job ID: ${jobId}`)
  wlog(`Type: mannequin`)

  try {
    await prisma.generation.update({
      where: { jobId },
      data: { status: 'processing' },
    })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      try {
        await updateDevGeneration(jobId, (gen) => ({ ...gen, status: 'processing' }))
      } catch {
        // Generation not in devStore yet — create it
        await createDevGeneration({
          userId,
          jobId,
          type: 'mannequin',
          status: 'processing',
          creditCost,
          productName,
          prompt: mannequinPrompt,
          negPrompt: null,
          quality,
          inputUrls: productFilePath ? [`/generations/${jobId}/product-1.jpg`] : [],
          outputUrls: [],
          mannequinId: job.data.mannequinId,
          errorMsg: null,
          parentGenerationId: null,
        })
      }
    } else {
      throw error
    }
  }

  const productBase64 = await loadFileAsBase64(productFilePath)
  if (!productBase64) {
    await updateDevGeneration(jobId, (gen) => ({ ...gen, status: 'failed', errorMsg: 'Ürün görseli okunamadı' })).catch(() => {})
    wlog(`${jobId} failed — product image not readable`)
    return
  }
  const backgroundBase64 = hasBackground ? await loadFileAsBase64(backgroundFilePath) : null
  const mannequinPersonBase64 = await loadFileAsBase64(mannequinReferenceFilePath ?? null)

  wlog(`Reference image: YES (base64 length: ${productBase64.length})`)
  wlog(`Mannequin ref: ${mannequinPersonBase64 ? `YES (base64 length: ${mannequinPersonBase64.length})` : 'NO'}`)
  wlog(`Background ref: ${backgroundBase64 ? 'YES' : 'NO'}`)

  const { description: productDescription } = await analyzeProduct(productBase64)
  const productLabel = productDescription || productName

  const activePoseData: Record<string, string> = {
    ...DEFAULT_POSE_DATA,
    ...(poseData ?? {}),
  }

  const results = await Promise.allSettled(
    selectedPoses.map((poseId, idx) => {
      const poseDescription = activePoseData[poseId] ?? DEFAULT_POSE_DATA[poseId] ?? poseId
      const backgroundClause = backgroundBase64
        ? 'studio background as shown in the scene'
        : 'pure white studio background'

      wlog(`Pose ${idx + 1}/${selectedPoses.length}: ${poseId} — "${productLabel}"`)

      return generateMannequinPose({
        productImageBase64: productBase64!,
        mannequinImageBase64: mannequinPersonBase64 ?? undefined,
        poseDescription,
        productLabel,
        mannequinPrompt,
        backgroundClause,
        realismSuffix,
      }).then((buf) => [buf])
    })
  )

  const outputUrls: string[] = []
  const outputPoseNames: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const poseId = selectedPoses[i]
    if (result.status === 'fulfilled' && result.value.length > 0) {
      const url = await saveImage(result.value[0], jobId, i + 1)
      outputUrls.push(url)
      outputPoseNames.push(POSE_NAMES[poseId] ?? poseId)
    } else if (result.status === 'rejected') {
      wlog(`Pose ${i + 1} failed: ${result.reason?.message}`)
    }
    await job.updateProgress(Math.round(((i + 1) / results.length) * 100))
  }

  if (outputUrls.length === 0) {
    try {
      await prisma.generation.update({
        where: { jobId },
        data: { status: 'failed', errorMsg: 'Tüm görsel üretimleri başarısız' },
      })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        await updateDevGeneration(jobId, (gen) => ({ ...gen, status: 'failed', errorMsg: 'Tüm görsel üretimleri başarısız' })).catch(() => {})
      }
    }
    if (process.env.SKIP_CREDIT_CHECK !== 'true') {
      await refundCredits(userId, creditCost, jobId)
    }
    wlog(`${jobId} failed — all poses failed`)
    return
  }

  const generation = await (async () => {
    try {
      return await prisma.generation.update({
        where: { jobId },
        data: { status: 'completed', outputUrls, completedAt: new Date() },
      })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return updateDevGeneration(jobId, (gen) => ({
          ...gen,
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
  wlog(`${jobId} completed — ${outputUrls.length} images`)
  return { imageUrls: outputUrls, poseNames: outputPoseNames }
}
