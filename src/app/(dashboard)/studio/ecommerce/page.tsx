'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import JSZip from 'jszip'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Upload, X, Download, ShoppingBag, ImageIcon, AlertCircle } from 'lucide-react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { toVertexCompatibleDataUrl } from '@/lib/browserImage'

export default function EcommercePage() {
  const { token, refreshCredits } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [productName, setProductName] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [outputUrls, setOutputUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [currentPoseIdx, setCurrentPoseIdx] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const poseRef = useRef<NodeJS.Timeout | null>(null)

  const poseNames = t.studio.ecommerce.poseNames

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 3))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 10 * 1024 * 1024,
  })

  const handleGenerate = async () => {
    if (!productName.trim()) return
    setLoading(true)
    setError('')
    setCurrentPoseIdx(0)
    try {
      const inputUrls = await Promise.all(files.map(toVertexCompatibleDataUrl))
      const res = await fetchWithAuth('/api/generate', token, {
        method: 'POST',
        body: JSON.stringify({ type: 'ecommerce', productName, quality: '1k', inputUrls }),
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
    if (status !== 'processing') { clearInterval(poseRef.current!); return }
    poseRef.current = setInterval(() => {
      setCurrentPoseIdx((prev) => Math.min(prev + 1, poseNames.length - 1))
    }, 14000)
    return () => clearInterval(poseRef.current!)
  }, [status, poseNames.length])

  useEffect(() => {
    if (!jobId || status !== 'processing') return
    pollRef.current = setInterval(async () => {
      const res = await fetchWithAuth(`/api/generate/status/${jobId}`, token, { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'completed') {
          setStatus('completed')
          setOutputUrls(data.outputUrls)
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

  const downloadZip = async () => {
    const zip = new JSZip()
    await Promise.all(outputUrls.map(async (url, i) => {
      const res = await fetch(url)
      const blob = await res.blob()
      zip.file(`ecommerce-${i + 1}.jpg`, blob)
    }))
    const content = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(content)
    a.download = `${productName}-ecommerce.zip`
    a.click()
  }

  const reset = () => {
    setStatus('idle')
    setJobId(null)
    setOutputUrls([])
    setError('')
    setCurrentPoseIdx(0)
  }

  return (
    <div className="max-w-5xl mx-auto">
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
        <h1 className="text-2xl font-bold text-white">{t.studio.ecommerce.title}</h1>
        {status === 'completed' && (
          <button onClick={downloadZip} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2 rounded-lg transition">
            <Download size={14} /> ZIP
          </button>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">{t.studio.ecommerce.subtitle}</p>

      {error && status !== 'failed' && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-72 flex-shrink-0 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t.studio.ecommerce.referenceImages}</label>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'}`}>
              <input {...getInputProps()} />
              <Upload size={20} className="text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500">{t.studio.ecommerce.maxImages}</p>
            </div>
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {files.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-16 object-cover rounded-lg" />
                    <button onClick={() => setFiles(p => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">{t.studio.ecommerce.productName} *</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
              placeholder={t.studio.ecommerce.productNamePlaceholder}
            />
          </div>

          <div className="pt-2">
            <div className="text-xs text-gray-500 mb-2 text-center">
              {t.studio.ecommerce.totalCostLabel}: <span className="text-yellow-400 font-medium">1 {t.common.credits}</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!productName.trim() || loading || status === 'processing'}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <ShoppingBag size={16} />
              {loading || status === 'processing' ? t.studio.ecommerce.generating : t.studio.ecommerce.generateButton}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#111111] border border-white/10 rounded-2xl p-6">
          {status === 'idle' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <ImageIcon size={32} className="text-gray-600 mb-3" />
              <p className="text-gray-500">{t.studio.ecommerce.emptyState}</p>
            </div>
          )}
          {status === 'processing' && (
            <div>
              <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
                <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${((currentPoseIdx + 1) / poseNames.length) * 100}%` }} />
              </div>
              <p className="text-center text-gray-400 text-sm mb-1">
                {currentPoseIdx + 1}/{poseNames.length} {t.studio.ecommerce.poseGenerating}
              </p>
              <p className="text-center text-purple-400 text-sm font-medium mb-6">{poseNames[currentPoseIdx]}</p>
              <div className="grid grid-cols-3 gap-3">
                {poseNames.map((name, i) => (
                  <div key={i} className="space-y-1">
                    <div className={`aspect-[2/3] rounded-xl ${i <= currentPoseIdx ? 'bg-purple-500/20 animate-pulse' : 'bg-white/5'}`} />
                    <p className="text-xs text-gray-600 text-center truncate">{name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {status === 'completed' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-white font-medium">{outputUrls.length} {t.studio.ecommerce.results}</p>
                <button onClick={reset} className="text-gray-500 hover:text-white text-sm transition">{t.studio.ecommerce.newSet}</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {outputUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={poseNames[i] ?? `${i + 1}`} className="w-full aspect-[2/3] object-cover rounded-xl" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition rounded-xl flex flex-col items-center justify-center gap-2">
                      <p className="text-white text-xs font-medium">{poseNames[i]}</p>
                      <a href={url} download={`${productName}-${i + 1}.jpg`} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg transition">
                        <Download size={12} /> {t.common.download}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {status === 'failed' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-red-400 font-medium">{t.studio.mannequin.failed}</p>
                <p className="text-gray-500 text-sm mt-1">{error}</p>
              </div>
              <button onClick={reset} className="text-purple-400 hover:text-purple-300 text-sm">{t.studio.mannequin.tryAgain}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
