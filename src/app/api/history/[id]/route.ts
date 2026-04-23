import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnavailable } from '@/lib/database'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerSession(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const generation = await prisma.generation.findUnique({ where: { id } })
    if (!generation) return Response.json({ error: 'Not found' }, { status: 404 })
    if (generation.userId !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

    // Delete output files from disk
    for (const url of generation.outputUrls) {
      try {
        const filePath = path.join(process.cwd(), 'public', url)
        await fs.unlink(filePath)
      } catch {
        // Ignore missing files
      }
    }

    // Try to remove the job directory entirely
    if (generation.jobId) {
      try {
        const dir = path.join(process.cwd(), 'public', 'generations', generation.jobId)
        await fs.rm(dir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    }

    await prisma.generation.delete({ where: { id } })

    return Response.json({ success: true })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return Response.json({ success: true })
    }
    return Response.json(
      { error: getPublicErrorMessage(error, 'Silme işlemi başarısız') },
      { status: getErrorStatus(error) }
    )
  }
}
