'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string
  name: string | null
  email: string
  credits: number
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshCredits: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedToken = localStorage.getItem('ps_token')
    const storedUser = localStorage.getItem('ps_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Giriş başarısız')
    localStorage.setItem('ps_token', data.token)
    localStorage.setItem('ps_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    router.push('/dashboard')
  }, [router])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Kayıt başarısız')
    localStorage.setItem('ps_token', data.token)
    localStorage.setItem('ps_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    router.push('/dashboard')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem('ps_token')
    localStorage.removeItem('ps_user')
    setToken(null)
    setUser(null)
    router.push('/login')
  }, [router])

  const refreshCredits = useCallback(async () => {
    const storedToken = localStorage.getItem('ps_token')
    if (!storedToken) return
    const res = await fetch('/api/credits/balance', {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setUser((prev) => {
        if (!prev) return prev
        const updated = { ...prev, credits: data.credits }
        localStorage.setItem('ps_user', JSON.stringify(updated))
        return updated
      })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
