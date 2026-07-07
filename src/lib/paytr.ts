import crypto from 'crypto'
import { getAppUrl, requireEnv } from './env'
import type { CreditPackage } from './creditPackages'

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token'

export function createPaytrCallbackHash(params: {
  merchantOid: string
  status: string
  totalAmount: string
}) {
  const merchantKey = requireEnv('PAYTR_MERCHANT_KEY')
  const merchantSalt = requireEnv('PAYTR_MERCHANT_SALT')
  const payload = `${params.merchantOid}${merchantSalt}${params.status}${params.totalAmount}`
  return crypto.createHmac('sha256', merchantKey).update(payload).digest('base64')
}

function createPaytrRequestHash(params: {
  merchantId: string
  userIp: string
  merchantOid: string
  email: string
  paymentAmount: string
  userBasket: string
  noInstallment: string
  maxInstallment: string
  currency: string
  testMode: string
}) {
  const merchantKey = requireEnv('PAYTR_MERCHANT_KEY')
  const merchantSalt = requireEnv('PAYTR_MERCHANT_SALT')
  const hashStr = [
    params.merchantId,
    params.userIp,
    params.merchantOid,
    params.email,
    params.paymentAmount,
    params.userBasket,
    params.noInstallment,
    params.maxInstallment,
    params.currency,
    params.testMode,
  ].join('')
  return crypto.createHmac('sha256', merchantKey).update(`${hashStr}${merchantSalt}`).digest('base64')
}

export async function createPaytrIframeToken(params: {
  package: CreditPackage
  merchantOid: string
  userIp: string
  userEmail: string
  userName: string
}) {
  const merchantId = requireEnv('PAYTR_MERCHANT_ID')
  const appUrl = getAppUrl()
  const paymentAmount = String(Math.round(params.package.amountTRY * 100))
  const userBasket = Buffer.from(JSON.stringify([
    [`Posemod ${params.package.name} Kredi Paketi`, params.package.amountTRY.toFixed(2), 1],
  ])).toString('base64')
  const noInstallment = '0'
  const maxInstallment = '0'
  const currency = 'TL'
  const testMode = process.env.PAYTR_TEST_MODE ?? '1'
  const paytrToken = createPaytrRequestHash({
    merchantId,
    userIp: params.userIp,
    merchantOid: params.merchantOid,
    email: params.userEmail,
    paymentAmount,
    userBasket,
    noInstallment,
    maxInstallment,
    currency,
    testMode,
  })

  const form = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: params.userIp.slice(0, 39),
    merchant_oid: params.merchantOid,
    email: params.userEmail,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: process.env.PAYTR_DEBUG_ON ?? '0',
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.userName.slice(0, 60) || 'Posemod Kullanıcı',
    user_address: process.env.PAYTR_DEFAULT_USER_ADDRESS ?? 'Online teslimat',
    user_phone: process.env.PAYTR_DEFAULT_USER_PHONE ?? '5551112233',
    merchant_ok_url: process.env.PAYTR_SUCCESS_URL ?? `${appUrl}/payment/success`,
    merchant_fail_url: process.env.PAYTR_FAIL_URL ?? `${appUrl}/payment/fail`,
    timeout_limit: process.env.PAYTR_TIMEOUT_LIMIT ?? '30',
    currency,
    test_mode: testMode,
    lang: 'tr',
  })

  const res = await fetch(PAYTR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = await res.json() as { status: 'success' | 'failed'; token?: string; reason?: string }
  if (!res.ok || data.status !== 'success' || !data.token) {
    throw new Error(data.reason ?? 'PayTR token alınamadı')
  }
  return data.token
}
