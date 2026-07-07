import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'
import { getCreditPackage } from '@/lib/creditPackages'
import { createPaytrIframeToken } from '@/lib/paytr'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })

  const limit = await checkRateLimit({
    key: `payment-create:${user.id}:${clientIp(request)}`,
    limit: 10,
    windowSeconds: 60 * 60,
  })
  if (!limit.ok) return Response.json({ error: 'Çok fazla ödeme denemesi. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })

  try {
    const { packageId } = await request.json() as { packageId?: string }
    if (!packageId) return Response.json({ error: 'Paket seçimi gerekli' }, { status: 400 })

    const selectedPackage = getCreditPackage(packageId)
    if (!selectedPackage) return Response.json({ error: 'Geçersiz kredi paketi' }, { status: 400 })

    const merchantOid = `PM${Date.now()}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`.slice(0, 64)
    await prisma.payment.create({
      data: {
        userId: user.id,
        merchantOid,
        packageId: selectedPackage.id,
        amountTRY: selectedPackage.amountTRY,
        credits: selectedPackage.credits,
        status: 'pending',
      },
    })

    const token = await createPaytrIframeToken({
      package: selectedPackage,
      merchantOid,
      userIp: clientIp(request),
      userEmail: user.email,
      userName: user.name ?? user.email,
    })

    return Response.json({
      token,
      merchantOid,
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${token}`,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Ödeme başlatılamadı' },
      { status: 500 }
    )
  }
}
