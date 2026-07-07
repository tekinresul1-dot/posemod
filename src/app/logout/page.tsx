'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function LogoutPage() {
  const { logout } = useAuth()

  useEffect(() => {
    logout()
  }, [logout])

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
      Çıkış yapılıyor...
    </div>
  )
}
