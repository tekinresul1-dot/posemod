import 'dotenv/config'
import { Worker } from 'bullmq'
import { processQuickSet } from './processors/quickSet'
import { processQuickSetRevision } from './processors/quickSetRevision'
import { processMannequinSet } from './processors/mannequinSet'
import { processMannequin } from './processors/mannequin'
import { prisma } from '@/lib/prisma'
import { refundCredits } from '@/lib/credits'
import { isDatabaseUnavailable } from '@/lib/database'
import { updateDevGeneration } from '@/lib/devStore'
import fs from 'fs'

const LOG_FILE = '/tmp/worker.log'
const RESTART_DELAY_MS = 3000

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { process.stdout.write(line) } catch {}
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
}

async function markFailed(jobId: string, errorMsg: string) {
  try {
    await prisma.generation.update({
      where: { jobId },
      data: { status: 'failed', errorMsg },
    })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await updateDevGeneration(jobId, (generation) => ({
        ...generation,
        status: 'failed',
        errorMsg,
      })).catch(() => {})
      return
    }
    throw error
  }
}

function startWorker() {
  log('Worker starting...')

  const worker = new Worker(
    'image-generation',
    async (job) => {
      log(`Job ${job.id} (${job.name}) started — jobId: ${job.data?.jobId}`)
      try {
        if (job.name === 'quick_set') return await processQuickSet(job)
        if (job.name === 'quick_set_revision') return await processQuickSetRevision(job)
        if (job.name === 'mannequin_set') return await processMannequinSet(job)
        if (job.name === 'mannequin') return await processMannequin(job)
        if (job.name === 'ecommerce') return await processQuickSet(job)
        if (job.name === 'remove_bg') return await processQuickSet(job)

        log(`Unknown job type: ${job.name} — marking failed`)
        if (job.data?.jobId) {
          await markFailed(job.data.jobId, `Bilinmeyen iş tipi: ${job.name}`).catch(() => {})
          if (job.data.userId && job.data.creditCost) {
            await refundCredits(job.data.userId, job.data.creditCost, job.data.jobId).catch(() => {})
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`Job ${job.id} (${job.name}) threw uncaught error: ${msg}`)
        if (job.data?.jobId) {
          await markFailed(job.data.jobId, msg).catch((e) => log(`markFailed error: ${e?.message ?? e}`))
          if (job.data.userId && job.data.creditCost) {
            await refundCredits(job.data.userId, job.data.creditCost, job.data.jobId).catch((e) => log(`refund error: ${e?.message ?? e}`))
          }
        }
        throw err
      }
    },
    {
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      concurrency: 3,
    }
  )

  worker.on('completed', (job) => {
    log(`Job ${job.id} (${job.name}) completed`)
  })

  worker.on('failed', (job, err) => {
    log(`Job ${job?.id} (${job?.name}) failed: ${err.message}`)
  })

  worker.on('error', (err) => {
    log(`Worker error: ${err.message}`)
    scheduleRestart(worker, 'worker-error')
  })

  worker.on('closed', () => {
    log('Worker connection closed')
    scheduleRestart(worker, 'worker-closed')
  })

  log('Worker started, listening for jobs...')
  return worker
}

let currentWorker: Worker | null = null
let restartScheduled = false

function scheduleRestart(oldWorker: Worker | null, reason: string) {
  if (restartScheduled) return
  restartScheduled = true
  log(`Scheduling worker restart in ${RESTART_DELAY_MS}ms (reason: ${reason})`)

  setTimeout(async () => {
    try {
      if (oldWorker) {
        await oldWorker.close().catch((e) => log(`Old worker close error: ${e?.message ?? e}`))
      }
    } catch (e) {
      log(`Worker close error: ${(e as Error)?.message ?? e}`)
    }
    try {
      currentWorker = startWorker()
    } catch (e) {
      log(`Worker restart failed: ${(e as Error)?.message ?? e}`)
      restartScheduled = false
      scheduleRestart(null, 'restart-failure')
      return
    }
    restartScheduled = false
  }, RESTART_DELAY_MS)
}

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`)
  scheduleRestart(currentWorker, 'uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  log(`Unhandled rejection: ${msg}`)
  scheduleRestart(currentWorker, 'unhandledRejection')
})

process.on('SIGTERM', async () => {
  log('SIGTERM received — shutting down')
  if (currentWorker) await currentWorker.close().catch(() => {})
  process.exit(0)
})

process.on('SIGINT', async () => {
  log('SIGINT received — shutting down')
  if (currentWorker) await currentWorker.close().catch(() => {})
  process.exit(0)
})

try {
  currentWorker = startWorker()
} catch (e) {
  log(`Initial worker start failed: ${(e as Error)?.message ?? e}`)
  scheduleRestart(null, 'initial-start-failure')
}
