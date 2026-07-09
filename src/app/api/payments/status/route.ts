import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })

  const merchantOid = request.nextUrl.searchParams.get('merchantOid')
  if (!merchantOid) return Response.json({ error: 'merchantOid gerekli' }, { status: 400 })

  const payment = await prisma.payment.findFirst({
    where: { merchantOid, userId: user.id },
    select: { merchantOid: true, status: true, packageId: true, amountTRY: true, credits: true, paidAt: true },
  })
  if (!payment) return Response.json({ error: 'Ödeme bulunamadı' }, { status: 404 })
  return Response.json({ payment })
}
