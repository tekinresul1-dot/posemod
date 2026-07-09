import { NextRequest } from 'next/server'
import { getServerSession, publicUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ user: null }, { status: 401 })
  return Response.json({ user: publicUser(user) })
}
