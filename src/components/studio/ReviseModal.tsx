"use client"

import { useState } from "react"
import { X, Wand2, Loader2, AlertCircle } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { IMAGE_FORMATS, ImageFormat } from "@/lib/imageFormats"
import { FormatSelector } from "./FormatSelector"

interface SourceImageInfo {
  id: string
  url: string
  productName: string
  prompt: string
  width: number
  height: number
}

interface ReviseModalProps {
  isOpen: boolean
  onClose: () => void
  sourceImage: SourceImageInfo
  onSubmit: (data: {
    revisionPrompt: string
    quality: string
    format: ImageFormat
    customWidth: number
    customHeight: number
  }) => Promise<void>
}

const QUALITY_OPTIONS = ['1k', '2k', '4k'] as const
type QualityOption = typeof QUALITY_OPTIONS[number]
const QUALITY_COSTS: Record<QualityOption, number> = { '1k': 0.1, '2k': 0.3, '4k': 0.5 }

export function ReviseModal({ isOpen, onClose, sourceImage, onSubmit }: ReviseModalProps) {
  const { t } = useLanguage()
  const [revisionPrompt, setRevisionPrompt] = useState('')
  const [quality, setQuality] = useState<QualityOption>('1k')
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>(IMAGE_FORMATS[0]!)
  const [customWidth, setCustomWidth] = useState(sourceImage.width)
  const [customHeight, setCustomHeight] = useState(sourceImage.height)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  if (!isOpen) return null

  const creditCost = QUALITY_COSTS[quality]

  const handleSubmit = async () => {
    if (!revisionPrompt.trim()) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({ revisionPrompt, quality, format: selectedFormat, customWidth, customHeight })
      onClose()
      setRevisionPrompt('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{t.studio.quickSet.reviseTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — fixed height, no outer scroll */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '1fr 1fr',
            maxHeight: 'calc(90vh - 65px)',
          }}
        >
          {/* Left: source image */}
          <div className="p-5 border-r border-white/10 flex flex-col" style={{ maxHeight: 'calc(90vh - 65px)' }}>
            <p className="text-xs text-gray-400 mb-2 flex-shrink-0">{t.studio.quickSet.sourceImage}</p>
            <div className="flex-1 rounded-xl overflow-hidden bg-[#0d0d0d] min-h-0">
              <img
                src={sourceImage.url}
                alt={sourceImage.productName}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 flex-shrink-0">{sourceImage.productName}</p>
          </div>

          {/* Right: form — scrollable only if needed */}
          <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 65px)' }}>
            {/* Error */}
            {submitError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{submitError}</p>
              </div>
            )}

            {/* Revision prompt */}
            <div>
              <label className="text-sm text-gray-300">{t.studio.quickSet.revisionDescription}</label>
              <textarea
                value={revisionPrompt}
                onChange={(e) => setRevisionPrompt(e.target.value)}
                placeholder={t.studio.quickSet.revisionPlaceholder}
                rows={3}
                className="w-full mt-1.5 px-3 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            {/* Quality */}
            <div>
              <label className="text-sm text-gray-300">{t.studio.quickSet.quality}</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      quality === q
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#0d0d0d] border border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {q.toUpperCase()}
                    <div className="text-[10px] text-yellow-400 mt-0.5">{QUALITY_COSTS[q]} K</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format — compact 4 columns */}
            <FormatSelector
              selectedFormat={selectedFormat}
              customWidth={customWidth}
              customHeight={customHeight}
              onFormatChange={setSelectedFormat}
              onCustomChange={(w, h) => { setCustomWidth(w); setCustomHeight(h) }}
              compact
            />

            {/* Submit */}
            <div className="pt-1">
              <div className="text-center text-sm text-gray-400 mb-2">
                {t.studio.quickSet.totalCredit}:{' '}
                <span className="text-yellow-400 font-semibold">
                  {creditCost} {t.common.credits}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !revisionPrompt.trim()}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.studio.quickSet.revising}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    {t.studio.quickSet.reviseButton} ({creditCost} {t.common.credits})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
