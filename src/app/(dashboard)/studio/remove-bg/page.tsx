'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Upload, Trash2, Download, ImageIcon, AlertCircle } from 'lucide-react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { toVertexCompatibleDataUrl } from '@/lib/browserImage'

export default function RemoveBgPage() {
  const { token, refreshCredits } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showCreditModal, setShowCreditModal] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const base64 = await toVertexCompatibleDataUrl(file)
      const res = await fetchWithAuth('/api/generate', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'remove_bg',
          productName: file.name.replace(/\.[^.]+$/, ''),
          quality: '1k',
          inputUrls: [base64],
        }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setShowCreditModal(true)
        return
      }
      if (!res.ok) throw new Error(data.error ?? t.common.error)
      setJobId(data.jobId)
      setStatus('processing')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!jobId || status !== 'processing') return
    pollRef.current = setInterval(async () => {
      const res = await fetchWithAuth(`/api/generate/status/${jobId}`, token, { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'completed') {
          setStatus('completed')
          setOutputUrl(data.outputUrls[0] ?? null)
          refreshCredits()
          clearInterval(pollRef.current!)
        } else if (data.status === 'failed') {
          setStatus('failed')
          setError(data.errorMsg ?? t.common.error)
          refreshCredits()
          clearInterval(pollRef.current!)
        }
      }
    }, 3000)
    return () => clearInterval(pollRef.current!)
  }, [jobId, status, token, refreshCredits, t])

  const reset = () => {
    setFile(null)
    setStatus('idle')
    setJobId(null)
    setOutputUrl(null)
    setError('')
  }

  return (
    <div className="max-w-2xl mx-auto">
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
            <AlertCircle size={40} className="text-yellow-400 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">{t.credits.insufficient}</h3>
            <p className="text-gray-400 text-sm mb-6">{t.credits.insufficientDesc}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCreditModal(false)} className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-lg text-sm hover:border-white/20 transition">
                {t.common.cancel}
              </button>
              <button onClick={() => router.push('/pricing')} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                {t.credits.buyButton}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">{t.studio.removeBg.title}</h1>
        {status === 'completed' && outputUrl && (
          <a href={outputUrl} download className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2 rounded-lg transition">
            <Download size={14} /> {t.common.download}
          </a>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">{t.studio.removeBg.subtitle}</p>

      {error && status !== 'failed' && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
              isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">{t.studio.removeBg.uploadHint}</p>
            <p className="text-gray-600 text-sm mt-1">{t.studio.removeBg.maxSize}</p>
          </div>
        ) : (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 object-cover rounded-xl" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{file.name}</p>
                <p className="text-gray-500 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={() => { setFile(null); setStatus('idle') }} className="text-gray-500 hover:text-white transition">
                <Trash2 size={16} />
              </button>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || status === 'processing'}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading || status === 'processing' ? t.common.loading : t.studio.removeBg.processButton}
            </button>
          </div>
        )}

        {status === 'processing' && (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 flex flex-col items-center">
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-400 text-sm">{t.studio.removeBg.processing}</p>
          </div>
        )}

        {status === 'completed' && outputUrl && (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
            <p className="text-white font-medium mb-4">{t.studio.removeBg.resultTitle}</p>
            <div className="relative group inline-block w-full">
              <img src={outputUrl} alt={t.studio.removeBg.resultTitle} className="w-full rounded-xl max-h-96 object-contain bg-[#1a1a1a]" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                <a href={outputUrl} download className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition">
                  <Download size={16} /> {t.common.download}
                </a>
              </div>
            </div>
            <button onClick={reset} className="w-full mt-4 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-sm py-2.5 rounded-lg transition">
              {t.studio.removeBg.newImage}
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <p className="text-red-400 font-medium mb-1">{t.studio.mannequin.failed}</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button onClick={reset} className="text-purple-400 hover:text-purple-300 text-sm">{t.studio.mannequin.tryAgain}</button>
          </div>
        )}

        {status === 'idle' && !file && (
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-8 flex flex-col items-center">
            <ImageIcon size={32} className="text-gray-600 mb-2" />
            <p className="text-gray-500 text-sm">{t.studio.removeBg.emptyState}</p>
          </div>
        )}
      </div>
    </div>
  )
}
