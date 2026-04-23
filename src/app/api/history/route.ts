import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnavailable } from '@/lib/database'
import { listDevGenerationsByUserId } from '@/lib/devStore'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

export async function GET(request: NextRequest) {
  try {
    const user = await getServerSession(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = { userId: user.id }
    if (type) where.type = type
    if (status) where.status = status

    const generations = await prisma.generation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return Response.json({ generations })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const user = await getServerSession(request)
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const all = await listDevGenerationsByUserId(user.id)
      const { searchParams } = new URL(request.url)
      const type = searchParams.get('type') ?? undefined
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
      const filtered = type ? all.filter((g) => g.type === type) : all
      return Response.json({ generations: filtered.slice(0, limit) })
    }
    return Response.json(
      { error: getPublicErrorMessage(error, 'Geçmiş yuklenemedi') },
      { status: getErrorStatus(error) }
    )
  }
}
