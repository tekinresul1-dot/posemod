import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'
import type { User, UserRole } from '@prisma/client'
import { isDatabaseUnavailable } from './database'
import { ensureDevUser } from './devStore'
import { isProduction } from './env'

const AUTH_COOKIE = 'posemod_session'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    if (isProduction()) {
      throw new Error('JWT_SECRET production ortamında en az 32 karakter olmalıdır')
    }
    return 'local-development-secret-change-me-32chars'
  }
  return secret
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string }
    return decoded
  } catch {
    return null
  }
}

export function authCookieHeader(token: string) {
  const secure = isProduction() ? '; Secure' : ''
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`
}

export function clearAuthCookieHeader() {
  const secure = isProduction() ? '; Secure' : ''
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

function getCookieToken(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const found = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE}=`))
  return found ? decodeURIComponent(found.slice(AUTH_COOKIE.length + 1)) : null
}

export async function getServerSession(request: Request): Promise<User | null> {
  const token = getBearerToken(request) ?? getCookieToken(request)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    return user
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (isProduction()) throw error
      return ensureDevUser(payload.userId)
    }
    throw error
  }
}

export async function requireServerSession(request: Request): Promise<User | Response> {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
  return user
}

export async function requireAdmin(request: Request): Promise<User | Response> {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
  if ((user.role as UserRole) !== 'ADMIN') {
    return Response.json({ error: 'Bu işlem için admin yetkisi gerekiyor' }, { status: 403 })
  }
  return user
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    credits: user.credits,
    pendingCredits: user.pendingCredits,
  }
}
