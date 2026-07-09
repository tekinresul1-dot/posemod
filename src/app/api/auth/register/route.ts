import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authCookieHeader, hashPassword, publicUser, signToken } from '@/lib/auth'
import { isDatabaseUnavailable } from '@/lib/database'
import { createDevUser, getDevUserByEmail } from '@/lib/devStore'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { normalizeEmail, validatePassword } from '@/lib/validation'
import { isProduction } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit({
      key: `register:${clientIp(request)}`,
      limit: 5,
      windowSeconds: 60 * 60,
    })
    if (!limit.ok) {
      return Response.json({ error: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })
    }

    const body = await request.json() as {
      name: string
      email: string
      password: string
    }
    const name = (body.name ?? '').trim()
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''

    if (!email || !password) {
      return Response.json({ error: 'Email ve şifre zorunludur' }, { status: 400 })
    }
    if (!validatePassword(password)) {
      return Response.json({ error: 'Şifre en az 8 karakter olmalıdır' }, { status: 400 })
    }

    let existing = null
    try {
      existing = await prisma.user.findUnique({ where: { email } })
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        if (isProduction()) throw error
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
          data: { name, email, passwordHash, credits: 3, role: 'USER' },
        })
      } catch (error) {
        if (isDatabaseUnavailable(error)) {
          if (isProduction()) throw error
          return createDevUser({ name, email, passwordHash, credits: 999 })
        }
        throw error
      }
    })()

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
