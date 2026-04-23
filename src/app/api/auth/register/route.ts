import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signToken } from '@/lib/auth'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevUser, getDevUserByEmail } from '@/lib/devStore'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json() as {
      name: string
      email: string
      password: string
    }

    if (!email || !password) {
      return Response.json({ error: 'Email ve şifre zorunludur' }, { status: 400 })
    }

    let existing = null
    try {
      existing = await prisma.user.findUnique({ where: { email } })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        existing = await getDevUserByEmail(email)
      } else {
        throw error
      }
    }
    if (existing) {
      return Response.json({ error: 'Bu email zaten kayıtlı' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await (async () => {
      try {
        return await prisma.user.create({
          data: { name, email, passwordHash, credits: 3 },
        })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          return createDevUser({ name, email, passwordHash, credits: 999 })
        }
        throw error
      }
    })()

    const token = signToken(user.id)
    return Response.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits },
    })
  } catch {
    return Response.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
