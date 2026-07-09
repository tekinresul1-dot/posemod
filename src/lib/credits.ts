import { prisma } from './prisma'
import { isDatabaseUnavailable } from './database'
import { ensureDevUser, updateDevUser } from './devStore'
import { isProduction } from './env'

export const CREDIT_COSTS: Record<string, number> = {
  quick_set: 0.1,
  quick_set_2k: 0.3,
  quick_set_4k: 0.5,
  quick_set_revision: 0.1,
  quick_set_revision_2k: 0.3,
  quick_set_revision_4k: 0.5,
  mannequin_set: 2.0,
  remove_bg: 0.2,
  ecommerce: 1.0,
  quality_2k: 0.3,
  quality_4k: 0.7,
}

export function roundCredits(amount: number) {
  return Math.round(amount * 100) / 100
}

export async function reserveCredits(userId: string, amount: number): Promise<boolean> {
  const creditAmount = roundCredits(amount)
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user || user.credits < creditAmount) {
        throw new Error('Insufficient credits')
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          credits: { decrement: creditAmount },
          pendingCredits: { increment: creditAmount },
        },
      })
    })
    return true
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (isProduction()) throw error
      const user = await ensureDevUser(userId)
      if (user.credits < creditAmount) return false

      await updateDevUser(userId, (current) => ({
        ...current,
        credits: roundCredits(current.credits - creditAmount),
        pendingCredits: roundCredits(current.pendingCredits + creditAmount),
      }))
      return true
    }
    return false
  }
}

export async function confirmUsage(
  userId: string,
  amount: number,
  generationId: string
): Promise<void> {
  const creditAmount = roundCredits(amount)
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findUnique({
        where: { type_reference: { type: 'usage', reference: generationId } },
      })
      if (existing) return

      await tx.user.update({
        where: { id: userId },
        data: { pendingCredits: { decrement: creditAmount } },
      })
      await tx.creditTransaction.create({
        data: { userId, amount: -creditAmount, type: 'usage', reference: generationId },
      })
    })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (isProduction()) throw error
      await updateDevUser(userId, (current) => ({
        ...current,
        pendingCredits: roundCredits(Math.max(0, current.pendingCredits - creditAmount)),
      }))
      return
    }
    throw error
  }
}

export async function refundCredits(
  userId: string,
  amount: number,
  ref: string
): Promise<void> {
  const creditAmount = roundCredits(amount)
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findUnique({
        where: { type_reference: { type: 'refund', reference: ref } },
      })
      if (existing) return

      await tx.user.update({
        where: { id: userId },
        data: {
          credits: { increment: creditAmount },
          pendingCredits: { decrement: creditAmount },
        },
      })
      await tx.creditTransaction.create({
        data: { userId, amount: creditAmount, type: 'refund', reference: ref },
      })
    })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (isProduction()) throw error
      await updateDevUser(userId, (current) => ({
        ...current,
        credits: roundCredits(current.credits + creditAmount),
        pendingCredits: roundCredits(Math.max(0, current.pendingCredits - creditAmount)),
      }))
      return
    }
    throw error
  }
}

export async function addPurchasedCredits(
  userId: string,
  amount: number,
  reference: string
): Promise<void> {
  const creditAmount = roundCredits(amount)
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { type_reference: { type: 'purchase', reference } },
    })
    if (existing) return

    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: creditAmount } },
    })
    await tx.creditTransaction.create({
      data: { userId, amount: creditAmount, type: 'purchase', reference },
    })
  })
}

export async function adjustCredits(
  userId: string,
  amount: number,
  reference: string,
  actorUserId: string
): Promise<void> {
  const creditAmount = roundCredits(amount)
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { type_reference: { type: 'admin_adjustment', reference } },
    })
    if (existing) return

    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: creditAmount } },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: creditAmount,
        type: 'admin_adjustment',
        reference,
        metadata: { actorUserId },
      },
    })
  })
}
