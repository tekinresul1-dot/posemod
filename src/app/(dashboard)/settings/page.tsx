'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Settings as SettingsIcon, Save, CheckCircle2 } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const storedUser = localStorage.getItem('ps_user')
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as { id: string; email: string; name: string | null; credits: number }
        localStorage.setItem('ps_user', JSON.stringify({ ...parsed, name }))
      }
      await new Promise((r) => setTimeout(r, 300))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon size={20} className="text-gray-400" />
        <h1 className="text-2xl font-bold text-white">{t.settings.title}</h1>
      </div>

      <form onSubmit={handleSave} className="bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">{t.settings.accountInfo}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.settings.fullName}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                placeholder={t.settings.fullNamePlaceholder}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.settings.email}</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-[#1a1a1a] border border-white/5 rounded-lg px-4 py-3 text-gray-500 text-sm cursor-not-allowed"
              />
              <p className="text-xs text-gray-600 mt-1">{t.settings.emailNote}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.settings.creditBalance}</label>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-lg px-4 py-3 text-yellow-400 text-sm font-medium">
                {user?.credits.toFixed(1) ?? '0.0'} {t.common.credits}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Save size={14} />
            {saving ? t.settings.saving : t.common.save}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 size={14} /> {t.settings.saved}
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="ml-auto text-sm text-red-400 hover:text-red-300 transition"
          >
            {t.common.logout}
          </button>
        </div>
      </form>
    </div>
  )
}
