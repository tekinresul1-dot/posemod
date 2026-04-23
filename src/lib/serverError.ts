import { isDatabaseUnavailable } from './database'

export function getPublicErrorMessage(error: unknown, fallback = 'Sunucu hatası') {
  const details = error as {
    code?: string
    message?: string
    cause?: { code?: string; message?: string }
  }

  const code = details?.code ?? details?.cause?.code
  const message = `${details?.message ?? ''} ${details?.cause?.message ?? ''}`.toLowerCase()

  if (isDatabaseUnavailable(error) || code === 'P1001' || message.includes('econnrefused') || message.includes("can't reach database")) {
    return 'Veritabani baglantisi kurulamadı. PostgreSQL servisini başlatıp tekrar deneyin.'
  }

  if (message.includes('redis') || message.includes('bullmq')) {
    return 'Kuyruk servisine baglanılamadı. Redis ayarlarını kontrol edip tekrar deneyin.'
  }

  return fallback
}

export function getErrorStatus(error: unknown, fallback = 500) {
  const details = error as {
    code?: string
    message?: string
    cause?: { code?: string; message?: string }
  }

  const code = details?.code ?? details?.cause?.code
  const message = `${details?.message ?? ''} ${details?.cause?.message ?? ''}`.toLowerCase()

  if (isDatabaseUnavailable(error) || code === 'P1001' || message.includes('econnrefused') || message.includes("can't reach database")) {
    return 503
  }

  if (message.includes('redis') || message.includes('bullmq')) {
    return 503
  }

  return fallback
}
