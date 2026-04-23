import { prisma } from './prisma'
import { isDatabaseUnavailable } from './database'
import { ensureDevUser, updateDevUser } from './devStore'

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

export async function reserveCredits(userId: string, amount: number): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user || user.credits < amount) {
        throw new Error('Insufficient credits')
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          credits: { decrement: amount },
          pendingCredits: { increment: amount },
        },
      })
    })
    return true
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const user = await ensureDevUser(userId)
      if (user.credits < amount) return false

      await updateDevUser(userId, (current) => ({
        ...current,
        credits: current.credits - amount,
        pendingCredits: current.pendingCredits + amount,
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
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { pendingCredits: { decrement: amount } },
      }),
      prisma.creditTransaction.create({
        data: { userId, amount: -amount, type: 'usage', reference: generationId },
      }),
    ])
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await updateDevUser(userId, (current) => ({
        ...current,
        pendingCredits: Math.max(0, current.pendingCredits - amount),
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
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          credits: { increment: amount },
          pendingCredits: { decrement: amount },
        },
      }),
      prisma.creditTransaction.create({
        data: { userId, amount, type: 'refund', reference: ref },
      }),
    ])
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      await updateDevUser(userId, (current) => ({
        ...current,
        credits: current.credits + amount,
        pendingCredits: Math.max(0, current.pendingCredits - amount),
      }))
      return
    }
    throw error
  }
}
