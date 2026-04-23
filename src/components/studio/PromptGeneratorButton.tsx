'use client'

import { useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

const POSE_VARIATIONS_EN = [
  'standing in a confident front-facing pose with one hand on hip',
  'walking naturally toward the camera with subtle dynamic motion',
  'turned slightly to the side in a 3/4 fashion editorial pose',
  'leaning casually against a wall with relaxed expression',
  'mid-step candid walking pose with natural arm movement',
]

const POSE_VARIATIONS_TR = [
  'kendinden emin bir duruşla, bir eli belde, önden poz',
  'kameraya doğru doğal bir yürüyüş pozu, hafif hareketli',
  '3/4 editoryal moda pozu, hafif yana dönük',
  'duvara yaslanmış rahat bir duruş, sakin ifade',
  'yürüyüş halinde doğal kol hareketleri ile samimi poz',
]

interface Props {
  productName: string
  hasReference: boolean
  currentPrompt: string
  onPromptGenerated: (newPrompt: string) => void
}

export default function PromptGeneratorButton({
  productName,
  hasReference,
  currentPrompt,
  onPromptGenerated,
}: Props) {
  const { language, t } = useLanguage()
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!productName.trim()) return

    if (currentPrompt.trim().length > 0) {
      const ok = confirm(t.studio.quickSet.confirmOverwrite)
      if (!ok) return
    }

    setLoading(true)
    await new Promise((r) => setTimeout(r, 500))

    const idx = Math.floor(Math.random() * 5)
    const pose = language === 'tr'
      ? POSE_VARIATIONS_TR[idx]!
      : POSE_VARIATIONS_EN[idx]!

    const generatedPrompt = language === 'tr'
      ? `${productName} giyen bir mankenin profesyonel e-ticaret moda çekimi.\n` +
        (hasReference ? `Orijinal ürünü AYNEN koru: aynı renk, desen, kumaş, tasarım ve tüm detaylar. Renk değişikliği, kumaş değişikliği ve bozulma olmasın.\n` : '') +
        (hasReference ? `Referansta görünüyorsa manken kimliğini ve yüzünü koru.\n` : '') +
        `Yeni doğal bir poz üret: ${pose}.\n` +
        `Tam boy kompozisyon, temiz beyaz stüdyo arka planı, yumuşak ışık, minimal gölge.\n` +
        `Son derece gerçekçi, ürüne keskin odak, premium moda fotoğrafçılığı kalitesi.\n` +
        `9:16 dikey oran, pazar yeri için optimize, e-ticaret hazır.\n` +
        `Gerçek bir insan modeli, doğal cilt dokusu, yapay zeka görünümü yok, fotoğrafik gerçekçilik.`
      : `A professional e-commerce fashion photoshoot of a model wearing a ${productName}.\n` +
        (hasReference ? `Preserve the original product EXACTLY: identical color, pattern, fabric, design, and all details. No color variations, no fabric changes, no distortions.\n` : '') +
        (hasReference ? `Preserve the same model identity and face if visible in reference.\n` : '') +
        `Generate a new natural pose: ${pose}.\n` +
        `Full body composition, clean white studio background, soft diffused lighting, minimal shadows.\n` +
        `Highly realistic, sharp focus on the product, premium fashion photography quality.\n` +
        `9:16 portrait ratio, marketplace optimized, e-commerce ready.\n` +
        `Real human model with natural skin texture, no AI-generated look, photographic realism.`

    onPromptGenerated(generatedPrompt)
    setLoading(false)
  }

  const disabled = !productName.trim() || loading

  return (
    <button
      onClick={handleGenerate}
      disabled={disabled}
      title={!productName.trim() ? (language === 'tr' ? 'Önce ürün adı girin' : 'Enter product name first') : undefined}
      className="inline-flex items-center gap-2 px-4 py-2 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          {t.studio.quickSet.autoPromptLoading}
        </>
      ) : (
        <>
          <Wand2 size={14} />
          {t.studio.quickSet.autoPromptButton}
        </>
      )}
    </button>
  )
}
