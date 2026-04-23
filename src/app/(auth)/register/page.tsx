'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Camera } from 'lucide-react'

export default function RegisterPage() {
  const { register } = useAuth()
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.registerFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Camera className="text-purple-500" size={28} />
          <span className="text-xl font-bold text-white">Product Studio</span>
        </div>

        <div className="bg-[#111111] rounded-2xl p-8 border border-white/10">
          <h1 className="text-2xl font-bold text-white mb-2">{t.auth.registerTitle}</h1>
          <p className="text-gray-400 text-sm mb-6">{t.auth.registerSubtitle}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t.auth.name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                placeholder={t.auth.namePlaceholder}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t.auth.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                placeholder={t.auth.emailPlaceholder}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t.auth.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
                placeholder={t.auth.passwordMinLength}
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? t.auth.registering : t.auth.register}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            {t.auth.hasAccount}{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300">
              {t.auth.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
