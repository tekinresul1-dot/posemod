'use client'

import { Check, Zap } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

const PLAN_PRICES = ['₺99', '₺249', '₺699']
const PLAN_CREDITS = [50, 150, 500]
const PLAN_POPULAR = [false, true, false]
const PLAN_KEYS = ['starter', 'standard', 'pro'] as const

export default function PricingPage() {
  const { t } = useLanguage()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">{t.pricing.title}</h1>
        <p className="text-gray-400">{t.pricing.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {PLAN_KEYS.map((key, i) => {
          const plan = t.pricing.plans[key]
          const popular = PLAN_POPULAR[i]!
          return (
            <div
              key={key}
              className={`bg-[#111111] rounded-2xl p-6 border relative ${
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
                  <span className="text-3xl font-bold text-white">{PLAN_PRICES[i]}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Zap size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 text-sm font-medium">{PLAN_CREDITS[i]} {t.common.credits}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
                  popular
                    ? 'bg-purple-600/50 text-purple-300 cursor-not-allowed'
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {t.pricing.comingSoon}
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
