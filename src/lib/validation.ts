const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validatePassword(password: string) {
  return typeof password === 'string' && password.length >= 8
}

export function parseDataUri(dataUri: string): { mimeType: string; buffer: Buffer; ext: string } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  const mimeType = match[1].toLowerCase()
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) return null

  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > MAX_IMAGE_BYTES) return null

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  return { mimeType, buffer, ext }
}

export function validateText(value: unknown, max = 2000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}
