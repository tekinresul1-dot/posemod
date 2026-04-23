'use client'

import Link from 'next/link'
import { Sparkles, Users, Trash2, ShoppingBag } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function StudioPage() {
  const { t } = useLanguage()

  const MODULES = [
    { key: 'quickSet', href: '/studio/quick-set', icon: Sparkles },
    { key: 'mannequin', href: '/studio/mannequin', icon: Users },
    { key: 'removeBg', href: '/studio/remove-bg', icon: Trash2 },
    { key: 'ecommerce', href: '/studio/ecommerce', icon: ShoppingBag },
  ] as const

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">{t.studio.title}</h1>
      <p className="text-gray-400 mb-8">{t.studio.subtitle}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {MODULES.map((mod) => {
          const Icon = mod.icon
          const info = t.studio.modules[mod.key]
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="bg-[#111111] border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition group relative"
            >
              {info.badge && (
                <span className="absolute top-4 right-4 text-xs bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  {info.badge}
                </span>
              )}
              <div className="p-3 bg-purple-600/20 rounded-xl w-fit mb-4">
                <Icon size={22} className="text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-white group-hover:text-purple-300 transition mb-2">
                {info.label}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{info.desc}</p>
              <p className="text-sm text-yellow-400 font-medium">{info.cost}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
