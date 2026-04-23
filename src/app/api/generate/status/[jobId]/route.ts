import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnavailable } from '@/lib/database'
import { getDevGenerationByJobId } from '@/lib/devStore'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await ctx.params

  const generation = await (async () => {
    try {
      return await prisma.generation.findUnique({ where: { jobId } })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return getDevGenerationByJobId(jobId)
      }
      throw error
    }
  })()

  if (!generation || generation.userId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({
    status: generation.status,
    outputUrls: generation.outputUrls,
    errorMsg: generation.errorMsg,
  })
}
