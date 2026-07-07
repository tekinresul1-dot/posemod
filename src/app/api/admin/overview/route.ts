import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generationQueue } from '@/lib/queue'
import { Storage } from '@google-cloud/storage'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const [
    users,
    payments,
    transactions,
    generations,
    totals,
    paymentTotals,
    usedCredits,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, email: true, name: true, role: true, credits: true, pendingCredits: true, createdAt: true },
    }),
    prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.creditTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.generation.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.user.count(),
    prisma.payment.aggregate({ where: { status: 'success' }, _sum: { amountTRY: true }, _count: true }),
    prisma.creditTransaction.aggregate({ where: { type: 'usage' }, _sum: { amount: true } }),
  ])

  const checks = {
    database: 'ok',
    redis: 'unknown',
    storage: process.env.GCS_BUCKET_NAME ? 'ok' : 'missing_config',
    vertexConfig: process.env.GOOGLE_PROJECT_ID && process.env.GOOGLE_LOCATION ? 'ok' : 'missing_config',
  }

  try {
    await generationQueue.client
    checks.redis = 'ok'
  } catch {
    checks.redis = 'degraded'
  }

  if (process.env.GCS_BUCKET_NAME) {
    try {
      await new Storage().bucket(process.env.GCS_BUCKET_NAME).exists()
      checks.storage = 'ok'
    } catch {
      checks.storage = 'degraded'
    }
  }

  return Response.json({
    totals: {
      users: totals,
      successfulPayments: paymentTotals._count,
      successfulPaymentAmountTRY: paymentTotals._sum.amountTRY ?? 0,
      usedCredits: Math.abs(usedCredits._sum.amount ?? 0),
    },
    checks,
    users,
    payments,
    transactions,
    generations,
  })
}
