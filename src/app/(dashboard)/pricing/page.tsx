'use client'

import { useState } from 'react'
import { Check, Zap } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { CREDIT_PACKAGES } from '@/lib/creditPackages'

export default function PricingPage() {
  const { t } = useLanguage()
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function buyCredits(packageId: string) {
    setError('')
    setLoadingPackage(packageId)
    try {
      const res = await fetch('/api/payments/paytr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ödeme başlatılamadı')
      window.location.href = data.iframeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ödeme başlatılamadı')
    } finally {
      setLoadingPackage(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">{t.pricing.title}</h1>
        <p className="text-gray-400">{t.pricing.subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {CREDIT_PACKAGES.map((plan, i) => {
          const popular = i === 1
          return (
            <div
              key={plan.id}
              className={`bg-[#111111] rounded-lg p-6 border relative ${
                popular ? 'border-purple-500' : 'border-white/10'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t.pricing.popular}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                <div className="flex items-end gap-1 mt-3">
                  <span className="text-3xl font-bold text-white">₺{plan.amountTRY}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Zap size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 text-sm font-medium">{plan.credits} {t.common.credits}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {[plan.description, 'PayTR güvenli ödeme', 'Krediler ödeme onayında yüklenir'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => buyCredits(plan.id)}
                disabled={loadingPackage === plan.id}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
                  popular
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {loadingPackage === plan.id ? 'Yönlendiriliyor...' : 'Satın al'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-10 bg-[#111111] border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-gray-400 text-sm">
          {t.pricing.footerNote}{' '}
          <span className="text-yellow-400 font-medium">{t.pricing.freeCredits}</span>{' '}
          {t.pricing.footerNote2}
        </p>
      </div>
    </div>
  )
}
