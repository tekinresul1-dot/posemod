'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Trash2, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { ImageZoom } from '@/components/ui/ImageZoom'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface Mannequin {
  id: string
  name: string
  gender: string
  height: string | null
  size: string | null
  createdFrom: string
  referencePhotoUrl: string | null
  createdAt: string
}

export default function MannequinsPage() {
  const { token } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const [mannequins, setMannequins] = useState<Mannequin[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Mannequin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetchWithAuth('/api/mannequins', token, { method: 'GET' })
      const data = await res.json()
      if (res.ok) setMannequins(data.mannequins ?? [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetchWithAuth(`/api/mannequins/${deleteTarget.id}`, token, { method: 'DELETE' })
      if (res.ok) {
        setMannequins((prev) => prev.filter((m) => m.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
            <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">{t.mannequins.deleteConfirmTitle}</h3>
            <p className="text-gray-400 text-sm mb-6">
              <span className="text-white font-medium">{deleteTarget.name}</span> {t.mannequins.deleteConfirmDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-lg text-sm hover:border-white/20 transition"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition"
              >
                {deleting ? t.mannequins.deleting : t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">{t.mannequins.title}</h1>
        <button
          onClick={() => router.push('/studio/mannequin')}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition"
        >
          <Plus size={14} /> {t.mannequins.newMannequin}
        </button>
      </div>
      <p className="text-gray-400 text-sm mb-6">{t.mannequins.subtitle}</p>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[2/3] bg-[#111111] rounded-xl animate-pulse" />)}
        </div>
      ) : mannequins.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-6">{t.mannequins.empty}</p>
          <button
            onClick={() => router.push('/studio/mannequin')}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg transition"
          >
            <Plus size={16} /> {t.mannequins.createFirst}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {mannequins.map((m) => (
            <div key={m.id} className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden group relative">
              <div className="aspect-[2/3] bg-[#0d0d0d] flex items-center justify-center relative">
                {m.referencePhotoUrl ? (
                  <ImageZoom
                    src={m.referencePhotoUrl}
                    alt={m.name}
                    onClick={() => setLightboxImage(m.referencePhotoUrl)}
                    className="w-full h-full overflow-hidden"
                    zoomLevel={2.5}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-purple-600/20 flex items-center justify-center text-white text-3xl font-bold">
                    {m.name[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-4 pointer-events-none">
                  <button
                    onClick={() => router.push(`/studio/mannequin?mannequinId=${m.id}`)}
                    className="pointer-events-auto w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded-lg transition"
                  >
                    <Sparkles size={12} /> {t.mannequins.generateWith}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="pointer-events-auto w-full flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs px-3 py-2 rounded-lg transition"
                  >
                    <Trash2 size={12} /> {t.common.delete}
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-bold truncate">{m.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.gender === 'Kadın' || m.gender === 'Female' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {m.gender}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{m.height || '-'} • {m.size || '-'}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                    {m.createdFrom === 'photo' ? t.mannequins.fromPhoto : t.mannequins.manual}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  )
}
