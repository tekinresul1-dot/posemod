import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authCookieHeader, publicUser, signToken, verifyPassword } from '@/lib/auth'
import { isDatabaseUnavailable } from '@/lib/database'
import { getDevUserByEmail } from '@/lib/devStore'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { normalizeEmail } from '@/lib/validation'
import { isProduction } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit({
      key: `login:${clientIp(request)}`,
      limit: 10,
      windowSeconds: 15 * 60,
    })
    if (!limit.ok) {
      return Response.json({ error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })
    }

    const body = await request.json() as {
      email: string
      password: string
    }
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''

    if (!email || !password) {
      return Response.json({ error: 'Email ve şifre zorunludur' }, { status: 400 })
    }

    const user = await (async () => {
      try {
        return await prisma.user.findUnique({ where: { email } })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          if (isProduction()) throw error
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
      user: publicUser(user),
    }, {
      headers: { 'Set-Cookie': authCookieHeader(token) },
    })
  } catch {
    return Response.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
