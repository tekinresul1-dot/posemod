'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Upload, X, Download, Sparkles, ImageIcon, AlertCircle, Wand2 } from 'lucide-react'
import { ImageZoom } from '@/components/ui/ImageZoom'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { toVertexCompatibleDataUrl } from '@/lib/browserImage'
import PromptGeneratorButton from '@/components/studio/PromptGeneratorButton'
import { ReviseModal } from '@/components/studio/ReviseModal'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { FormatSelector } from '@/components/studio/FormatSelector'
import { IMAGE_FORMATS, ImageFormat, getClosestAspectRatio } from '@/lib/imageFormats'

const QUALITY_OPTIONS = ['1k', '2k', '4k'] as const
type QualityOption = typeof QUALITY_OPTIONS[number]
const QUALITY_COSTS: Record<QualityOption, number> = { '1k': 0.1, '2k': 0.3, '4k': 0.5 }

interface GenerationHistoryItem {
  id: string
  url: string
  prompt: string
  productName: string
  width: number
  height: number
  format: string
  createdAt: Date
  parentGenerationId?: string | null
}

export default function QuickSetPage() {
  const { token, refreshCredits, user } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [productName, setProductName] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [pendingGenInfo, setPendingGenInfo] = useState<{ jobId: string; width: number; height: number; format: string; productName: string; prompt: string; sourceGenerationId?: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>(IMAGE_FORMATS[0]!)
  const [customWidth, setCustomWidth] = useState(1200)
  const [customHeight, setCustomHeight] = useState(1800)
  const [sessionHistory, setSessionHistory] = useState<GenerationHistoryItem[]>([])
  const [displayedImage, setDisplayedImage] = useState<GenerationHistoryItem | null>(null)
  const [showReviseModal, setShowReviseModal] = useState(false)
  const [quality, setQuality] = useState<QualityOption>('1k')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const getFormatDimensions = () => {
    if (selectedFormat.id === 'custom') return { width: customWidth, height: customHeight }
    return { width: selectedFormat.width, height: selectedFormat.height }
  }

  useEffect(() => {
    if (!user?.id) return
    const saved = localStorage.getItem(`ps_quickset_history_${user.id}`)
    if (saved) {
      try {
        const parsed: GenerationHistoryItem[] = JSON.parse(saved)
        const withDates = parsed.map((item) => ({ ...item, createdAt: new Date(item.createdAt) }))
        setSessionHistory(withDates)
        if (withDates.length > 0) setDisplayedImage(withDates[0]!)
      } catch {}
    }
  }, [user?.id])

  useEffect(() => {
    if (!token) return
    async function loadHistory() {
      try {
        const res = await fetchWithAuth('/api/history?type=quick_set&limit=20&status=completed', token!, { method: 'GET' })
        if (!res.ok) return
        const data = await res.json() as { generations?: Array<{ id: string; outputUrls: string[]; prompt: string | null; productName: string; parentGenerationId?: string | null; metadata?: { width?: number; height?: number; format?: string }; createdAt: string }> }
        if (data.generations && data.generations.length > 0) {
          const formatted: GenerationHistoryItem[] = data.generations
            .filter((g) => g.outputUrls && g.outputUrls.length > 0)
            .map((g) => ({
              id: g.id,
              url: g.outputUrls[0]!,
              prompt: g.prompt ?? '',
              productName: g.productName,
              width: g.metadata?.width ?? 1200,
              height: g.metadata?.height ?? 1800,
              format: g.metadata?.format ?? 'trendyol',
              createdAt: new Date(g.createdAt),
              parentGenerationId: g.parentGenerationId ?? null,
            }))
          if (formatted.length > 0) {
            setSessionHistory(formatted)
            setDisplayedImage(formatted[0]!)
          }
        }
      } catch {}
    }
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!user?.id || sessionHistory.length === 0) return
    localStorage.setItem(`ps_quickset_history_${user.id}`, JSON.stringify(sessionHistory.slice(0, 20)))
  }, [sessionHistory, user?.id])

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 3))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 3,
  })

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleGenerate = async () => {
    if (!productName.trim()) return
    setLoading(true)
    setError('')
    try {
      const inputUrls = await Promise.all(files.map(toVertexCompatibleDataUrl))
      const { width, height } = getFormatDimensions()
      const aspectRatio = getClosestAspectRatio(width, height)
      const res = await fetchWithAuth('/api/generate', token, {
        method: 'POST',
        body: JSON.stringify({ type: 'quick_set', productName, quality, prompt: customPrompt || undefined, inputUrls, width, height, aspectRatio, language }),
      })
      const data = await res.json()
      if (res.status === 402) { setShowCreditModal(true); return }
      if (!res.ok) throw new Error(data.error ?? t.common.error)
      setJobId(data.jobId)
      setPendingGenInfo({ jobId: data.jobId, width, height, format: selectedFormat.id, productName, prompt: customPrompt })
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
        const data = await res.json() as { status: string; outputUrls?: string[]; errorMsg?: string; id?: string }
        if (data.status === 'completed') {
          setStatus('completed')
          const url = data.outputUrls?.[0] ?? null
          setOutputUrl(url)
          refreshCredits()
          clearInterval(pollRef.current!)
          if (url && pendingGenInfo) {
            const newItem: GenerationHistoryItem = {
              id: data.id ?? pendingGenInfo.jobId,
              url, prompt: pendingGenInfo.prompt, productName: pendingGenInfo.productName,
              width: pendingGenInfo.width, height: pendingGenInfo.height, format: pendingGenInfo.format,
              createdAt: new Date(), parentGenerationId: pendingGenInfo.sourceGenerationId ?? null,
            }
            setSessionHistory((prev) => [newItem, ...prev.slice(0, 19)])
            setDisplayedImage(newItem)
          }
        } else if (data.status === 'failed') {
          setStatus('failed')
          setError(data.errorMsg ?? t.common.error)
          refreshCredits()
          clearInterval(pollRef.current!)
        }
      }
    }, 3000)
    return () => clearInterval(pollRef.current!)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, status, token, refreshCredits, t])

  const reset = () => {
    setStatus('idle'); setJobId(null); setOutputUrl(null); setError(''); setPendingGenInfo(null)
  }

  const loadSettings = (item: GenerationHistoryItem) => {
    setProductName(item.productName)
    setCustomPrompt(item.prompt)
    const fmt = IMAGE_FORMATS.find((f) => f.id === item.format)
    if (fmt) { setSelectedFormat(fmt) } else {
      setSelectedFormat(IMAGE_FORMATS.find((f) => f.id === 'custom')!)
      setCustomWidth(item.width); setCustomHeight(item.height)
    }
  }

  const handleRevise = async (data: { revisionPrompt: string; quality: string; format: ImageFormat; customWidth: number; customHeight: number }) => {
    if (!displayedImage) return
    const width = data.format.id === 'custom' ? data.customWidth : data.format.width
    const height = data.format.id === 'custom' ? data.customHeight : data.format.height
    const aspectRatio = getClosestAspectRatio(width, height)
    const res = await fetchWithAuth('/api/generate', token, {
      method: 'POST',
      body: JSON.stringify({ type: 'quick_set_revision', productName: displayedImage.productName, quality, sourceImageUrl: displayedImage.url, sourceGenerationId: displayedImage.id, revisionPrompt: data.revisionPrompt, width, height, aspectRatio, language }),
    })
    if (res.status === 402) { setShowCreditModal(true); throw new Error('insufficient_credits') }
    const json = await res.json()
    if (!res.ok) { console.error('[handleRevise] API error:', json); throw new Error(json.error ?? t.common.error) }
    const newJobId = json.jobId as string
    setPendingGenInfo({ jobId: newJobId, width, height, format: data.format.id, productName: displayedImage.productName, prompt: data.revisionPrompt, sourceGenerationId: displayedImage.id })
    setJobId(newJobId); setStatus('processing'); setOutputUrl(null); setShowReviseModal(false)
  }

  const handleDeleteHistory = async (item: GenerationHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t.common.deleteConfirm)) return
    setSessionHistory((prev) => prev.filter((h) => h.id !== item.id))
    if (displayedImage?.id === item.id) setDisplayedImage(sessionHistory.filter((h) => h.id !== item.id)[0] ?? null)
    try { await fetchWithAuth(`/api/history/${item.id}`, token, { method: 'DELETE' }) } catch {}
  }

  const activeItem = status === 'completed' && outputUrl
    ? { url: outputUrl, width: pendingGenInfo?.width ?? getFormatDimensions().width, height: pendingGenInfo?.height ?? getFormatDimensions().height, productName }
    : displayedImage
      ? { url: displayedImage.url, width: displayedImage.width, height: displayedImage.height, productName: displayedImage.productName }
      : null

  return (
    <>
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={22} className="text-yellow-400" />
            </div>
            <h3 className="text-white font-semibold text-base mb-2">{t.credits.insufficient}</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{t.credits.insufficientDesc}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCreditModal(false)} className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-lg text-sm hover:border-white/20 hover:text-white transition">
                {t.common.cancel}
              </button>
              <button onClick={() => router.push('/pricing')} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                {t.credits.buyButton}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-white">{t.studio.quickSet.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{t.studio.quickSet.subtitle}</p>
        </div>

        <div className="flex gap-5 items-start">

          {/* Left column — form */}
          <div className="w-[420px] shrink-0 bg-zinc-900/40 border border-white/10 rounded-2xl p-5 space-y-4">

            {/* Reference images */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.studio.quickSet.referenceImages} <span className="text-xs text-zinc-500 font-normal">({t.common.optional})</span>
              </label>
              {files.length === 0 ? (
                <div
                  {...getRootProps()}
                  className={`border border-dashed rounded-xl py-3 px-4 text-center cursor-pointer transition min-h-[80px] flex flex-col items-center justify-center ${
                    isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload size={16} className="text-gray-600 mb-1" />
                  <p className="text-xs text-gray-500">{t.studio.quickSet.uploadHint}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.studio.quickSet.maxSize}</p>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {files.map((f, i) => (
                    <div key={i} className="relative group w-16 h-16 shrink-0">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1a1a1a] border border-white/15 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={10} className="text-gray-300" />
                      </button>
                    </div>
                  ))}
                  {files.length < 3 && (
                    <div
                      {...getRootProps()}
                      className="w-16 h-16 border-2 border-dashed border-white/10 hover:border-white/20 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0"
                    >
                      <input {...getInputProps()} />
                      <Upload size={14} className="text-gray-600" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.studio.quickSet.productName} <span className="text-red-500">*</span></label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full h-9 bg-zinc-900 border border-white/10 focus:border-purple-500/50 rounded-lg px-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition"
                placeholder={t.studio.quickSet.productNamePlaceholder}
              />
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.studio.quickSet.prompt}</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 focus:border-purple-500/50 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none transition resize-none"
                style={{ minHeight: 110, maxHeight: 160 }}
                placeholder={t.studio.quickSet.promptPlaceholder}
              />
              <div className="flex justify-end mt-1.5">
                <PromptGeneratorButton
                  productName={productName}
                  hasReference={files.length > 0}
                  currentPrompt={customPrompt}
                  onPromptGenerated={(newPrompt) => setCustomPrompt(newPrompt)}
                />
              </div>
            </div>

            {/* Format */}
            <FormatSelector
              selectedFormat={selectedFormat}
              customWidth={customWidth}
              customHeight={customHeight}
              onFormatChange={setSelectedFormat}
              onCustomChange={(w, h) => { setCustomWidth(w); setCustomHeight(h) }}
              compact
            />

            {/* Quality */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.studio.quickSet.quality}</label>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      quality === q
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-900 border border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {q.toUpperCase()}
                    <div className="text-[10px] text-yellow-400 mt-0.5">{QUALITY_COSTS[q]} K</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={!productName.trim() || loading || status === 'processing'}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              {loading || status === 'processing' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {t.studio.quickSet.generateButton}
                  <span className="text-yellow-300 text-xs ml-1">({QUALITY_COSTS[quality]} K)</span>
                </>
              )}
            </button>
          </div>

          {/* Right column — output */}
          <div className="w-[520px] shrink-0 space-y-3">

            {error && status !== 'failed' && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Image viewer */}
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#0a0a0a]">

              {/* Toolbar */}
              {(activeItem || status === 'processing' || status === 'failed') && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 min-w-0">
                    {status === 'processing' ? (
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                        </span>
                        <span className="text-xs text-gray-400">{t.studio.quickSet.processing}</span>
                      </div>
                    ) : status === 'failed' ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span className="text-xs text-gray-400">{t.studio.mannequin.failed}</span>
                      </div>
                    ) : activeItem ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400">{t.studio.quickSet.currentGeneration}</span>
                        <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{activeItem.width}×{activeItem.height}</span>
                      </div>
                    ) : null}
                  </div>
                  {activeItem && status !== 'processing' && (
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <button
                        onClick={() => setShowReviseModal(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-purple-500/20 bg-purple-500/8 text-purple-300 hover:bg-purple-500/14 hover:border-purple-500/30 transition-colors h-7"
                      >
                        <Wand2 size={10} />
                        {t.studio.quickSet.revise}
                      </button>
                      <a
                        href={activeItem.url}
                        download="product-studio.jpg"
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/6 hover:bg-white/10 text-gray-300 hover:text-white transition-colors h-7"
                      >
                        <Download size={10} />
                        {t.common.download}
                      </a>
                      {status === 'completed' && (
                        <button onClick={reset} className="px-2 py-1 rounded-md text-xs text-gray-600 hover:text-gray-400 hover:bg-white/4 transition-colors h-7">
                          {t.studio.quickSet.newImage}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Image area */}
              <div className="bg-[#080808] min-h-[200px]">
                {status === 'idle' && !displayedImage && (
                  <div className="flex flex-col items-center text-center py-12 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-center mb-4">
                      <ImageIcon size={22} className="text-gray-700" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">{t.studio.quickSet.emptyState}</p>
                    <p className="text-xs text-gray-700 mt-1.5 max-w-xs leading-relaxed">{t.studio.quickSet.emptyHint}</p>
                  </div>
                )}

                {status === 'processing' && (
                  <div className="flex flex-col items-center text-center py-16 px-6">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/8 border border-purple-500/12 flex items-center justify-center">
                        <Sparkles size={24} className="text-purple-400" />
                      </div>
                      <div className="absolute inset-0 rounded-2xl border border-purple-500/25 animate-ping" />
                    </div>
                    <p className="text-sm text-white font-medium mb-1.5">{t.studio.quickSet.processing}</p>
                    <p className="text-xs text-gray-600">{t.studio.quickSet.processingHint}</p>
                    <div className="mt-5 w-36 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full w-3/5 bg-gradient-to-r from-purple-600/80 to-purple-400 rounded-full animate-pulse" />
                    </div>
                  </div>
                )}

                {status === 'failed' && (
                  <div className="flex flex-col items-center text-center py-16 px-6">
                    <div className="mb-4 px-5 py-3.5 rounded-xl bg-red-500/6 border border-red-500/12">
                      <p className="text-sm text-red-400 font-medium">{t.studio.mannequin.failed}</p>
                      {error && <p className="text-xs text-gray-500 mt-1">{error}</p>}
                    </div>
                    <button onClick={reset} className="text-xs text-purple-400 hover:text-purple-300 transition">
                      {t.studio.mannequin.tryAgain}
                    </button>
                  </div>
                )}

                {activeItem && status !== 'processing' && (
                  <div
                    style={{
                      aspectRatio: `${activeItem.width}/${activeItem.height}`,
                      maxHeight: 'calc(100vh - 200px)',
                      width: '100%',
                    }}
                  >
                    <ImageZoom
                      src={activeItem.url}
                      alt={activeItem.productName}
                      objectFit="contain"
                      className="w-full h-full"
                      onClick={() => {
                        const idx = displayedImage ? sessionHistory.findIndex(h => h.id === displayedImage.id) : -1
                        setLightboxIndex(idx >= 0 ? idx : null)
                        setLightboxImage(activeItem.url)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Bottom meta */}
              {displayedImage && status !== 'completed' && status !== 'processing' && (
                <div className="px-3 py-2 border-t border-white/[0.05] flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 truncate">{displayedImage.productName}</span>
                  <span className="text-zinc-700 text-xs">·</span>
                  <span className="text-xs text-zinc-600 shrink-0 tabular-nums">{displayedImage.width}×{displayedImage.height}</span>
                  <button onClick={() => loadSettings(displayedImage)} className="ml-auto shrink-0 text-xs text-purple-400/70 hover:text-purple-300 transition">
                    {t.studio.quickSet.restoreSettings}
                  </button>
                </div>
              )}
            </div>

            {/* History grid */}
            {sessionHistory.length > 0 && (
              <div className="bg-zinc-900/40 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-gray-500">{t.studio.quickSet.previousGenerations}</span>
                  <span className="text-xs text-gray-700 tabular-nums">{sessionHistory.length}</span>
                </div>
                <div className="grid grid-cols-8 gap-2 lg:grid-cols-10">
                  {sessionHistory.map((item) => (
                    <div key={item.id} className="relative group">
                      <div
                        onClick={() => { setDisplayedImage(item); if (status === 'completed') reset(); setLightboxImage(item.url); setLightboxIndex(sessionHistory.findIndex(h => h.id === item.id)) }}
                        className={`aspect-[2/3] rounded-md overflow-hidden cursor-pointer ring-1 transition-all duration-150 ${
                          displayedImage?.id === item.id && status !== 'completed'
                            ? 'ring-purple-500 brightness-100'
                            : 'ring-transparent hover:ring-white/15 brightness-75 hover:brightness-100'
                        }`}
                      >
                        <img src={item.url} alt={item.productName} className="w-full h-full object-cover" />
                        {item.parentGenerationId && (
                          <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-sm bg-purple-600 flex items-center justify-center">
                            <span className="text-[6px] font-bold text-white leading-none">R</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistory(item, e)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-2 h-2 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => { setLightboxImage(null); setLightboxIndex(null) }}
        onDownload={lightboxImage ? () => {
          const a = document.createElement('a')
          a.href = lightboxImage
          a.download = 'product-studio.jpg'
          a.click()
        } : undefined}
        onPrev={lightboxIndex !== null && lightboxIndex > 0 ? () => {
          const prev = sessionHistory[lightboxIndex - 1]
          if (prev) { setLightboxImage(prev.url); setLightboxIndex(lightboxIndex - 1) }
        } : undefined}
        onNext={lightboxIndex !== null && lightboxIndex < sessionHistory.length - 1 ? () => {
          const next = sessionHistory[lightboxIndex + 1]
          if (next) { setLightboxImage(next.url); setLightboxIndex(lightboxIndex + 1) }
        } : undefined}
      />

      {showReviseModal && activeItem && (
        <ReviseModal
          isOpen={showReviseModal}
          onClose={() => setShowReviseModal(false)}
          sourceImage={{
            id: displayedImage?.id ?? '',
            url: activeItem.url,
            productName: activeItem.productName,
            prompt: displayedImage?.prompt ?? '',
            width: activeItem.width,
            height: activeItem.height,
          }}
          onSubmit={handleRevise}
        />
      )}
    </>
  )
}
