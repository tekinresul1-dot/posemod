import { prisma } from '@/lib/prisma'
import { generationQueue } from '@/lib/queue'
import { Storage } from '@google-cloud/storage'

export async function GET() {
  const checks = {
    database: 'ok',
    redis: 'ok',
    storage: 'ok',
    vertexConfig: 'ok',
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.database = 'degraded'
  }

  try {
    const client = await generationQueue.client
    await client.ping()
  } catch {
    checks.redis = 'degraded'
  }

  if (!process.env.GCS_BUCKET_NAME) {
    checks.storage = 'missing_config'
  } else {
    try {
      await new Storage().bucket(process.env.GCS_BUCKET_NAME).exists()
    } catch {
      checks.storage = 'degraded'
    }
  }

  if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_LOCATION) {
    checks.vertexConfig = 'missing_config'
  }

  const degraded = Object.values(checks).some((value) => value !== 'ok')
  return Response.json({
    status: degraded ? 'degraded' : 'ok',
    app: 'posemod',
    env: process.env.NODE_ENV ?? 'development',
    checks,
  }, { status: degraded ? 503 : 200 })
}
