'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, CreditCard, Database, Shield, Users, Zap } from 'lucide-react'

type AdminData = {
  totals: {
    users: number
    successfulPayments: number
    successfulPaymentAmountTRY: number
    usedCredits: number
  }
  checks: Record<string, string>
  users: Array<{
    id: string
    email: string
    name: string | null
    role: string
    credits: number
    pendingCredits: number
    createdAt: string
  }>
  payments: Array<{ id: string; merchantOid: string; status: string; amountTRY: number; credits: number; createdAt: string }>
  transactions: Array<{ id: string; userId: string; amount: number; type: string; reference: string | null; createdAt: string }>
  generations: Array<{ id: string; jobId: string; type: string; status: string; errorMsg: string | null; createdAt: string }>
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  async function load() {
    const res = await fetch('/api/admin/overview')
    if (!res.ok) {
      setError(res.status === 403 ? 'Bu sayfa sadece admin kullanıcılar içindir.' : 'Admin verileri alınamadı.')
      return
    }
    setData(await res.json())
  }

  useEffect(() => {
    load()
  }, [])

  async function adjustCredits(userId: string) {
    const amount = Number(amounts[userId])
    if (!Number.isFinite(amount) || amount === 0) return
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: 'Admin panel adjustment' }),
    })
    if (res.ok) {
      setAmounts((prev) => ({ ...prev, [userId]: '' }))
      await load()
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-4 text-red-400" size={32} />
          <h1 className="text-2xl font-bold mb-2">Admin erişimi</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link href="/dashboard" className="text-purple-300 hover:text-purple-200">Dashboard’a dön</Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const metricCards = [
    { label: 'Kullanıcı', value: data.totals.users, icon: Users },
    { label: 'Başarılı ödeme', value: data.totals.successfulPayments, icon: CreditCard },
    { label: 'Toplam TRY', value: data.totals.successfulPaymentAmountTRY.toFixed(2), icon: Activity },
    { label: 'Kullanılan kredi', value: data.totals.usedCredits.toFixed(2), icon: Zap },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Posemod Admin</h1>
            <p className="text-sm text-gray-400">Kullanıcı, ödeme, kredi ve sistem durumu</p>
          </div>
          <Link href="/dashboard" className="text-sm text-purple-300 hover:text-purple-200">Dashboard</Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {metricCards.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="bg-[#111111] border border-white/10 rounded-lg p-4">
                <Icon className="text-purple-300 mb-3" size={18} />
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-xl font-semibold">{item.value}</p>
              </div>
            )
          })}
        </section>

        <section className="bg-[#111111] border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-purple-300" />
            <h2 className="font-semibold">Sistem health</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(data.checks).map(([key, value]) => (
              <div key={key} className="bg-white/5 rounded-md px-3 py-2">
                <p className="text-xs text-gray-500">{key}</p>
                <p className={value === 'ok' ? 'text-green-400' : 'text-yellow-400'}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#111111] border border-white/10 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold">Kullanıcılar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 bg-white/5">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Rol</th>
                  <th className="text-left p-3">Kredi</th>
                  <th className="text-left p-3">Pending</th>
                  <th className="text-left p-3">Manuel kredi</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-t border-white/5">
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{user.role}</td>
                    <td className="p-3">{user.credits.toFixed(2)}</td>
                    <td className="p-3">{user.pendingCredits.toFixed(2)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <input
                          value={amounts[user.id] ?? ''}
                          onChange={(e) => setAmounts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          className="w-28 bg-black/40 border border-white/10 rounded-md px-2 py-1"
                          placeholder="+10 / -5"
                        />
                        <button
                          onClick={() => adjustCredits(user.id)}
                          className="bg-purple-600 hover:bg-purple-700 rounded-md px-3 py-1"
                        >
                          Uygula
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <LogList title="Ödemeler" rows={data.payments.map((p) => `${p.status} | ${p.amountTRY} TRY | ${p.credits} kredi | ${p.merchantOid}`)} />
          <LogList title="Kredi hareketleri" rows={data.transactions.map((t) => `${t.type} | ${t.amount} | ${t.reference ?? '-'}`)} />
          <LogList title="Generation" rows={data.generations.map((g) => `${g.status} | ${g.type} | ${g.errorMsg ?? g.jobId}`)} />
        </section>
      </div>
    </div>
  )
}

function LogList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-lg p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="space-y-2 max-h-80 overflow-auto">
        {rows.slice(0, 30).map((row, i) => (
          <p key={`${row}-${i}`} className="text-xs text-gray-400 bg-white/5 rounded-md p-2">{row}</p>
        ))}
      </div>
    </div>
  )
}
