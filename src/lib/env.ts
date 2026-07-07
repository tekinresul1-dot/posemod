export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} ortam değişkeni tanımlı değil`)
  }
  return value
}

export function requireProductionEnv(name: string): string | undefined {
  const value = process.env[name]
  if (isProduction() && !value) {
    throw new Error(`${name} production ortamında zorunludur`)
  }
  return value
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
