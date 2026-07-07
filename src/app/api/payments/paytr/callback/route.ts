import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPaytrCallbackHash } from '@/lib/paytr'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const merchantOid = String(form.get('merchant_oid') ?? '')
  const status = String(form.get('status') ?? '')
  const totalAmount = String(form.get('total_amount') ?? '')
  const hash = String(form.get('hash') ?? '')
  const rawCallback = Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)])
  )

  const expectedHash = createPaytrCallbackHash({ merchantOid, status, totalAmount })
  if (!merchantOid || hash !== expectedHash) {
    return new Response('PAYTR notification failed: bad hash', { status: 400 })
  }

  const payment = await prisma.payment.findUnique({ where: { merchantOid } })
  if (!payment) return new Response('OK', { status: 200 })

  if (payment.status === 'success' || payment.status === 'failed' || payment.status === 'cancelled') {
    return new Response('OK', { status: 200 })
  }

  if (status === 'success') {
    await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { merchantOid } })
      if (!current || current.status === 'success') return
      const existingPurchase = await tx.creditTransaction.findUnique({
        where: { type_reference: { type: 'purchase', reference: merchantOid } },
      })
      if (existingPurchase) {
        await tx.payment.update({
          where: { merchantOid },
          data: { status: 'success', rawCallback, paidAt: current.paidAt ?? new Date() },
        })
        return
      }

      await tx.payment.update({
        where: { merchantOid },
        data: { status: 'success', rawCallback, paidAt: new Date() },
      })
      await tx.user.update({
        where: { id: current.userId },
        data: { credits: { increment: current.credits } },
      })
      await tx.creditTransaction.create({
        data: {
          userId: current.userId,
          amount: current.credits,
          type: 'purchase',
          reference: merchantOid,
          metadata: { provider: 'paytr', paymentId: current.id, totalAmount },
        },
      })
    })
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { merchantOid },
        data: { status: 'failed', rawCallback },
      })
      await tx.creditTransaction.create({
        data: {
          userId: payment.userId,
          amount: 0,
          type: 'payment_failed',
          reference: merchantOid,
          metadata: rawCallback,
        },
      }).catch(() => undefined)
    })
  }

  return new Response('OK', { status: 200 })
}
