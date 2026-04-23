export function isDatabaseUnavailable(error: unknown): boolean {
  const details = error as {
    code?: string
    message?: string
    cause?: { code?: string; message?: string }
  }

  const code = details?.code ?? details?.cause?.code
  const message = `${details?.message ?? ''} ${details?.cause?.message ?? ''}`.toLowerCase()

  return (
    code === 'P1001' ||
    code === 'ECONNREFUSED' ||
    message.includes("can't reach database") ||
    message.includes('econnrefused') ||
    message.includes('schema engine error')
  )
}
