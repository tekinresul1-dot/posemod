import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signToken } from '@/lib/auth'
import { isDatabaseUnavailable } from '@/lib/database'
import { getDevUserByEmail } from '@/lib/devStore'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as {
      email: string
      password: string
    }

    const user = await (async () => {
      try {
        return await prisma.user.findUnique({ where: { email } })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          return getDevUserByEmail(email)
        }
        throw error
      }
    })()
    if (!user) {
      return Response.json({ error: 'Email veya şifre hatalı' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return Response.json({ error: 'Email veya şifre hatalı' }, { status: 401 })
    }

    const token = signToken(user.id)
    return Response.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits },
    })
  } catch {
    return Response.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
