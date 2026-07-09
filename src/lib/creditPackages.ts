export type CreditPackage = {
  id: string
  name: string
  credits: number
  amountTRY: number
  description: string
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter-100', name: 'Başlangıç', credits: 100, amountTRY: 199, description: 'Küçük katalog denemeleri için' },
  { id: 'standard-250', name: 'Standart', credits: 250, amountTRY: 449, description: 'Düzenli ürün çekimleri için' },
  { id: 'pro-500', name: 'Pro', credits: 500, amountTRY: 799, description: 'Yoğun e-ticaret kullanımı için' },
  { id: 'agency-1000', name: 'Ajans', credits: 1000, amountTRY: 1499, description: 'Ajans ve ekip çalışmaları için' },
]

export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find((item) => item.id === packageId) ?? null
}
