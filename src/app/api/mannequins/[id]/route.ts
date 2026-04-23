import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await ctx.params
    const mannequin = await prisma.mannequin.findUnique({ where: { id } })
    if (!mannequin) {
      return Response.json({ error: 'Manken bulunamadı' }, { status: 404 })
    }
    if (mannequin.userId !== user.id) {
      return Response.json({ error: 'Bu mankeni silme yetkiniz yok' }, { status: 403 })
    }

    await prisma.mannequin.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: getPublicErrorMessage(error, 'Manken silinemedi') },
      { status: getErrorStatus(error) }
    )
  }
}
