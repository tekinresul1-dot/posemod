'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Zap, Sparkles, Users, Image, Trash2, ShoppingBag } from 'lucide-react'

interface Generation {
  id: string
  jobId: string
  type: string
  status: string
  productName: string | null
  outputUrls: string[]
  createdAt: string
}

export default function DashboardPage() {
  const { user, token, refreshCredits } = useAuth()
  const { t } = useLanguage()
  const [recent, setRecent] = useState<Generation[]>([])

  const QUICK_ACTIONS = [
    { key: 'quickSet', href: '/studio/quick-set', icon: Sparkles, color: 'purple' },
    { key: 'mannequin', href: '/studio/mannequin', icon: Users, color: 'blue' },
    { key: 'removeBg', href: '/studio/remove-bg', icon: Trash2, color: 'green' },
    { key: 'ecommerce', href: '/studio/ecommerce', icon: ShoppingBag, color: 'orange' },
  ] as const

  const fetchRecent = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setRecent(data.generations.slice(0, 5))
    }
  }, [token])

  useEffect(() => {
    fetchRecent()
    refreshCredits()
  }, [fetchRecent, refreshCredits])

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return t.dashboard.status.completed
    if (status === 'failed') return t.dashboard.status.failed
    return t.dashboard.status.processing
  }

  const getTypeLabel = (type: string) =>
    t.dashboard.typeLabels[type as keyof typeof t.dashboard.typeLabels] ?? type

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.dashboard.welcome}, {user?.name ?? user?.email} 👋</h1>
        <p className="text-gray-400 mt-1">{t.dashboard.subtitle}</p>
      </div>

      <div className="bg-gradient-to-br from-purple-600/30 to-purple-900/20 border border-purple-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="text-yellow-400" size={20} />
          <span className="text-gray-300 text-sm">{t.dashboard.currentCredits}</span>
        </div>
        <p className="text-4xl font-bold text-white">{user?.credits.toFixed(1)}</p>
        <p className="text-purple-300 text-sm mt-1">{t.common.credits}</p>
        <Link
          href="/pricing"
          className="inline-block mt-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {t.dashboard.buyCredits}
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">{t.dashboard.quickAccess}</h2>
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            const info = t.dashboard.quickActions[action.key]
            return (
              <Link
                key={action.href}
                href={action.href}
                className="bg-[#111111] border border-white/10 hover:border-purple-500/50 rounded-xl p-4 transition group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Icon size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white group-hover:text-purple-300 transition">{info.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
                    <p className="text-xs text-yellow-400 mt-1">{info.cost}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{t.dashboard.recentGenerations}</h2>
          <Link href="/history" className="text-sm text-purple-400 hover:text-purple-300">{t.dashboard.seeAll}</Link>
        </div>

        {recent.length === 0 ? (
          <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
            <Image size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{t.dashboard.noGenerations}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((gen) => (
              <div key={gen.id} className="bg-[#111111] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                {gen.outputUrls[0] ? (
                  <img src={gen.outputUrls[0]} alt="" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                    <Image size={16} className="text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{gen.productName ?? t.common.untitled}</p>
                  <p className="text-xs text-gray-500">{getTypeLabel(gen.type)} • {new Date(gen.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  gen.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                  gen.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {getStatusLabel(gen.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
