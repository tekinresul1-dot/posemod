import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { adjustCredits } from '@/lib/credits'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (admin instanceof Response) return admin

  const { id } = await ctx.params
  const { amount, reason } = await request.json() as { amount?: number; reason?: string }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
    return Response.json({ error: 'Geçerli kredi miktarı girin' }, { status: 400 })
  }

  const reference = `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  await adjustCredits(id, amount, reference, admin.id)
  return Response.json({ ok: true, reference, reason: reason ?? null })
}
