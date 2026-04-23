'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Camera, Zap, Sparkles, Clock, Users, CreditCard, Settings, LogOut } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout, refreshCredits } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()

  const NAV_ITEMS = [
    { label: t.nav.dashboard, href: '/dashboard', icon: Zap },
    { label: t.nav.generator, href: '/studio', icon: Sparkles },
    { label: t.nav.history, href: '/history', icon: Clock },
    { label: t.nav.mannequins, href: '/mannequins', icon: Users },
    { label: t.nav.pricing, href: '/pricing', icon: CreditCard },
    { label: t.nav.settings, href: '/settings', icon: Settings },
  ]

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login')
    }
  }, [loading, token, router])

  useEffect(() => {
    if (!token) return
    refreshCredits()
    const id = setInterval(() => { refreshCredits() }, 15_000)
    const onFocus = () => refreshCredits()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [token, refreshCredits])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0A0A0A] overflow-hidden">
      <aside className="w-64 bg-[#111111] border-r border-white/5 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera className="text-purple-500" size={22} />
            <span className="font-bold text-white text-lg">Product Studio</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user.name ?? user.email}</p>
            </div>
          </div>

          {/* Language switcher */}
          <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
            <button
              onClick={() => setLanguage('tr')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                language === 'tr' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🇹🇷 TR
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                language === 'en' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🇬🇧 EN
            </button>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <LogOut size={16} />
            {t.common.logout}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-[#111111] border-b border-white/5 flex items-center justify-end px-6">
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-yellow-500/20 transition"
          >
            <Zap size={14} />
            {user.credits.toFixed(1)} {t.common.credits}
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
