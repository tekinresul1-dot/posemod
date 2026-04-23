"use client"
import { useState, useRef, MouseEvent } from "react"

interface ImageZoomProps {
  src: string
  alt?: string
  className?: string
  onClick?: () => void
  zoomLevel?: number
  objectFit?: 'cover' | 'contain'
}

export function ImageZoom({ src, alt, className, onClick, zoomLevel = 2.5, objectFit = 'cover' }: ImageZoomProps) {
  const [showZoom, setShowZoom] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden cursor-zoom-in ${className || ""}`}
      onMouseEnter={() => setShowZoom(true)}
      onMouseLeave={() => setShowZoom(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      <img src={src} alt={alt || ""} className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`} />

      {showZoom && (
        <div
          className="absolute pointer-events-none border-2 border-white/60 shadow-2xl rounded-md"
          style={{
            width: "180px",
            height: "180px",
            left: `calc(${position.x}% - 90px)`,
            top: `calc(${position.y}% - 90px)`,
            backgroundImage: `url(${src})`,
            backgroundSize: `${zoomLevel * 100}%`,
            backgroundPosition: `${position.x}% ${position.y}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  )
}
