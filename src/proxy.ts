import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const gcsBase = process.env.GCS_PUBLIC_BASE_URL ?? 'https://storage.googleapis.com'

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.paytr.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${gcsBase} https://storage.googleapis.com`,
      "connect-src 'self' https://www.paytr.com https://*.googleapis.com",
      "frame-src 'self' https://www.paytr.com",
      `form-action 'self' ${appUrl} https://www.paytr.com`,
    ].join('; ')
  )

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
