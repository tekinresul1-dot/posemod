import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { isDatabaseUnavailable } from '@/lib/database'
import { ensureDevUser } from '@/lib/devStore'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

export async function GET(request: NextRequest) {
  try {
    const user = await getServerSession(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    return Response.json({ credits: user.credits, pendingCredits: user.pendingCredits })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (token) {
        const user = await getServerSession(request)
        if (user) {
          const devUser = await ensureDevUser(user.id)
          return Response.json({ credits: devUser.credits, pendingCredits: devUser.pendingCredits })
        }
      }
    }
    return Response.json(
      { error: getPublicErrorMessage(error, 'Kredi bilgisi alınamadı') },
      { status: getErrorStatus(error) }
    )
  }
}
