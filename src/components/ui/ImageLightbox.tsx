"use client"
import { useEffect, useState, MouseEvent } from "react"
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"

interface ImageLightboxProps {
  imageUrl: string | null
  onClose: () => void
  onDownload?: () => void
  onPrev?: () => void
  onNext?: () => void
}

export function ImageLightbox({ imageUrl, onClose, onDownload, onPrev, onNext }: ImageLightboxProps) {
  const { t } = useLanguage()
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!imageUrl) {
      setIsVisible(false)
      return
    }
    const timer = setTimeout(() => setIsVisible(true), 10)

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.5, 5))
      if (e.key === "-") setZoom(z => Math.max(z - 0.5, 1))
      if (e.key === "ArrowLeft") onPrev?.()
      if (e.key === "ArrowRight") onNext?.()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"

    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      setZoom(1)
      setPosition({ x: 0, y: 0 })
    }, 200)
  }

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(1, Math.min(5, z + (e.deltaY > 0 ? -0.2 : 0.2))))
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  if (!imageUrl) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleBackdropClick}
    >
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        className="absolute top-6 left-6 flex gap-2 z-10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setZoom(z => Math.min(z + 0.5, 5))}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setZoom(z => Math.max(z - 0.5, 1))
            if (zoom <= 1.5) setPosition({ x: 0, y: 0 })
          }}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-white/10 text-white text-sm flex items-center">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {onPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {onNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className={`relative flex items-center justify-center transition-all duration-300 ease-out ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none rounded-lg shadow-2xl"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
        />
      </div>

      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 z-10 backdrop-blur-sm transition-colors"
        >
          <Download className="w-5 h-5" />
          {t.common.download}
        </button>
      )}

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none whitespace-nowrap">
        {t.common.lightboxHint}
      </div>
    </div>
  )
}
