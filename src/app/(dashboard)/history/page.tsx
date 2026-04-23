'use client'

import { useEffect, useState, useCallback } from 'react'
import JSZip from 'jszip'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Clock, Download, ImageIcon } from 'lucide-react'
import { ImageZoom } from '@/components/ui/ImageZoom'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface Generation {
  id: string
  jobId: string
  type: string
  status: string
  productName: string | null
  outputUrls: string[]
  creditCost: number
  createdAt: string
}

export default function HistoryPage() {
  const { token } = useAuth()
  const { t } = useLanguage()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setGenerations(data.generations)
    }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const downloadZip = async (gen: Generation) => {
    const zip = new JSZip()
    await Promise.all(gen.outputUrls.map(async (url, i) => {
      const res = await fetch(url)
      const blob = await res.blob()
      zip.file(`pose-${i + 1}.jpg`, blob)
    }))
    const content = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(content)
    a.download = `${gen.productName ?? 'set'}.zip`
    a.click()
  }

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return t.history.status.completed
    if (status === 'failed') return t.history.status.failed
    return t.history.status.processing
  }

  const getTypeLabel = (type: string) =>
    t.history.typeLabels[type as keyof typeof t.history.typeLabels] ?? type

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-gray-400" />
        <h1 className="text-2xl font-bold text-white">{t.history.title}</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-[#111111] rounded-xl animate-pulse" />)}
        </div>
      ) : generations.length === 0 ? (
        <div className="bg-[#111111] border border-white/5 rounded-xl p-12 text-center">
          <ImageIcon size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">{t.history.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => (
            <div key={gen.id} className="bg-[#111111] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {gen.outputUrls.slice(0, 4).map((url, i) => (
                    <ImageZoom
                      key={i}
                      src={url}
                      onClick={() => setLightboxImage(url)}
                      className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                      zoomLevel={3}
                    />
                  ))}
                  {gen.outputUrls.length === 0 && (
                    <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                      <ImageIcon size={16} className="text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{gen.productName ?? t.common.untitled}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                      {getTypeLabel(gen.type)}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(gen.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-yellow-400">{gen.creditCost} {t.history.credit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    gen.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    gen.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {getStatusLabel(gen.status)}
                  </span>
                  {gen.outputUrls.length > 0 && (
                    <button
                      onClick={() => downloadZip(gen)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        onDownload={lightboxImage ? () => { const a = document.createElement('a'); a.href = lightboxImage; a.download = 'image.jpg'; a.click() } : undefined}
      />
    </div>
  )
}
