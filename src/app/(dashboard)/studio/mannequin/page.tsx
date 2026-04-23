'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useDropzone } from 'react-dropzone'
import JSZip from 'jszip'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Upload, X, Download, ImageIcon, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { toVertexCompatibleDataUrl } from '@/lib/browserImage'
import { ImageZoom } from '@/components/ui/ImageZoom'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface Mannequin {
  id: string
  name: string
  gender: string
  ageRange: string | null
  height: string | null
  size: string | null
  skinTone: string | null
  hairColor: string | null
  hairLength: string | null
  eyeColor: string | null
  ethnicity: string | null
  customPrompt: string | null
  referencePhotoUrl: string | null
  createdFrom: string
}

type QualityOption = '1k' | '2k' | '4k'

const POSE_IDS = ['front', 'back', 'right', 'left', 'angle45right', 'angle45left'] as const

const GENDER_OPTIONS_TR = ['Kadın', 'Erkek']
const GENDER_OPTIONS_EN = ['Female', 'Male']
const AGE_OPTIONS = ['18-25', '25-35', '35-45']
const HEIGHT_OPTIONS = ['155cm', '160cm', '165cm', '170cm', '175cm', '180cm']
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL']
const SKIN_OPTIONS_TR = ['Açık', 'Orta', 'Koyu', 'Esmer']
const SKIN_OPTIONS_EN = ['Light', 'Medium', 'Dark', 'Tan']
const HAIR_COLOR_OPTIONS_TR = ['Siyah', 'Kahverengi', 'Sarı', 'Kızıl', 'Gri']
const HAIR_COLOR_OPTIONS_EN = ['Black', 'Brown', 'Blonde', 'Red', 'Grey']
const HAIR_LENGTH_OPTIONS_TR = ['Kısa', 'Orta', 'Uzun']
const HAIR_LENGTH_OPTIONS_EN = ['Short', 'Medium', 'Long']
const EYE_COLOR_OPTIONS_TR = ['Kahverengi', 'Yeşil', 'Mavi', 'Siyah']
const EYE_COLOR_OPTIONS_EN = ['Brown', 'Green', 'Blue', 'Black']
const ETHNICITY_OPTIONS_TR = ['Türk', 'Avrupalı', 'Orta Doğu', 'Afrikalı', 'Asyalı', 'Latin']
const ETHNICITY_OPTIONS_EN = ['Turkish', 'European', 'Middle Eastern', 'African', 'Asian', 'Latin']

interface FormDataType {
  name: string
  gender: string
  ageRange: string
  height: string
  size: string
  skinTone: string
  hairColor: string
  hairLength: string
  eyeColor: string
  ethnicity: string
  customPrompt: string
}

const EMPTY_FORM: FormDataType = {
  name: '', gender: '', ageRange: '', height: '', size: '',
  skinTone: '', hairColor: '', hairLength: '', eyeColor: '', ethnicity: '', customPrompt: '',
}

function MannequinStudioInner() {
  const { token, refreshCredits } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetId = searchParams.get('mannequinId')

  const [step, setStep] = useState(1)
  const [mannequins, setMannequins] = useState<Mannequin[]>([])
  const [selectedMannequin, setSelectedMannequin] = useState<Mannequin | null>(null)
  const [productFiles, setProductFiles] = useState<File[]>([])
  const [productName, setProductName] = useState('')
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [selectedPoses, setSelectedPoses] = useState<string[]>([...POSE_IDS])
  const [quality, setQuality] = useState<QualityOption>('1k')
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [results, setResults] = useState<string[]>([])
  const [poseNames, setPoseNames] = useState<string[]>([])
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mannequinsLoading, setMannequinsLoading] = useState(true)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzedOk, setAnalyzedOk] = useState(false)
  const [creatingMannequin, setCreatingMannequin] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const genderOptions = language === 'tr' ? GENDER_OPTIONS_TR : GENDER_OPTIONS_EN
  const skinOptions = language === 'tr' ? SKIN_OPTIONS_TR : SKIN_OPTIONS_EN
  const hairColorOptions = language === 'tr' ? HAIR_COLOR_OPTIONS_TR : HAIR_COLOR_OPTIONS_EN
  const hairLengthOptions = language === 'tr' ? HAIR_LENGTH_OPTIONS_TR : HAIR_LENGTH_OPTIONS_EN
  const eyeColorOptions = language === 'tr' ? EYE_COLOR_OPTIONS_TR : EYE_COLOR_OPTIONS_EN
  const ethnicityOptions = language === 'tr' ? ETHNICITY_OPTIONS_TR : ETHNICITY_OPTIONS_EN

  const getPoseName = (id: string) =>
    t.studio.mannequin.poseNames[id as keyof typeof t.studio.mannequin.poseNames] ?? id

  const loadMannequins = useCallback(async () => {
    try {
      setMannequinsLoading(true)
      const res = await fetchWithAuth('/api/mannequins', token, { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.common.error)
      setMannequins(data.mannequins ?? [])
      return (data.mannequins ?? []) as Mannequin[]
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
      return []
    } finally {
      setMannequinsLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (!token) return
    loadMannequins().then((list) => {
      if (presetId) {
        const preset = list.find((m) => m.id === presetId)
        if (preset) { setSelectedMannequin(preset); setStep(2) }
      }
    })
  }, [token, presetId, loadMannequins])

  const productDropzone = useDropzone({
    onDrop: (accepted) => setProductFiles((prev) => [...prev, ...accepted].slice(0, 5)),
    accept: { 'image/*': [] },
    maxSize: 10 * 1024 * 1024,
  })

  const backgroundDropzone = useDropzone({
    onDrop: (accepted) => { if (accepted[0]) setBackgroundFile(accepted[0]) },
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setPhotoPreview(base64)
      setAnalyzing(true)
      setAnalyzedOk(false)
      try {
        const res = await fetchWithAuth('/api/mannequins/analyze', token, {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64 }),
        })
        const data = await res.json()
        setFormData((prev) => ({
          ...prev,
          gender: data.gender || prev.gender,
          ageRange: data.ageRange || prev.ageRange,
          height: data.height || prev.height,
          size: data.size || prev.size,
          skinTone: data.skinTone || prev.skinTone,
          hairColor: data.hairColor || prev.hairColor,
          hairLength: data.hairLength || prev.hairLength,
          eyeColor: data.eyeColor || prev.eyeColor,
          ethnicity: data.ethnicity || prev.ethnicity,
          customPrompt: data.additionalFeatures || prev.customPrompt,
        }))
        if (data.gender || data.skinTone || data.hairColor) setAnalyzedOk(true)
      } catch {
        setAnalyzedOk(false)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleCreateMannequin = async () => {
    if (!formData.name.trim()) { setError(t.common.error); return }
    if (!formData.gender) { setError(t.common.error); return }
    setCreatingMannequin(true)
    setError('')
    try {
      const res = await fetchWithAuth('/api/mannequins', token, {
        method: 'POST',
        body: JSON.stringify({ ...formData, referencePhotoUrl: photoPreview, createdFrom: photoPreview ? 'photo' : 'manual' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.common.error)
      const list = await loadMannequins()
      const created = list.find((m) => m.id === data.mannequin.id) ?? data.mannequin
      setSelectedMannequin(created)
      setShowModal(false)
      setFormData(EMPTY_FORM)
      setPhotoPreview(null)
      setAnalyzedOk(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setCreatingMannequin(false)
    }
  }

  const togglePose = (id: string) => {
    setSelectedPoses((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  const handleGenerate = async () => {
    if (!selectedMannequin || !productName.trim() || productFiles.length === 0) return
    setLoading(true)
    setError('')
    try {
      const productDataUrls = await Promise.all(productFiles.map(toVertexCompatibleDataUrl))
      const backgroundDataUrl = backgroundFile ? await toVertexCompatibleDataUrl(backgroundFile) : null
      const res = await fetchWithAuth('/api/generate', token, {
        method: 'POST',
        body: JSON.stringify({
          type: 'mannequin',
          mannequinId: selectedMannequin.id,
          productName,
          productImageBase64: productDataUrls[0],
          backgroundImageBase64: backgroundDataUrl,
          inputUrls: productDataUrls,
          selectedPoses,
          quality,
        }),
      })
      const data = await res.json()
      if (res.status === 402) { setShowCreditModal(true); return }
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
          setResults(data.outputUrls ?? [])
          setPoseNames(data.poseNames ?? selectedPoses.map(getPoseName))
          refreshCredits()
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (data.status === 'failed') {
          setStatus('failed')
          setError(data.errorMsg ?? t.common.error)
          refreshCredits()
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobId, status, token, refreshCredits, selectedPoses, t])

  const downloadZip = async () => {
    const zip = new JSZip()
    await Promise.all(results.map(async (url, i) => {
      const res = await fetch(url)
      const blob = await res.blob()
      zip.file(`${poseNames[i] ?? `pose-${i + 1}`}.jpg`, blob)
    }))
    const content = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(content)
    a.download = `${productName}-set.zip`
    a.click()
  }

  const reset = () => { setStatus('idle'); setJobId(null); setResults([]); setPoseNames([]); setError(''); setStep(1) }

  void Trash2

  return (
    <div className="max-w-5xl mx-auto">
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
            <AlertCircle size={40} className="text-yellow-400 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">{t.credits.insufficient}</h3>
            <p className="text-gray-400 text-sm mb-6">{t.credits.insufficientDesc}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCreditModal(false)} className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-lg text-sm hover:border-white/20 transition">{t.common.cancel}</button>
              <button onClick={() => router.push('/pricing')} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">{t.credits.buyButton}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">{t.studio.mannequinForm.title}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <label className="block cursor-pointer mb-6">
              <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500 transition">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="max-h-40 mx-auto rounded" />
                ) : (
                  <>
                    <Upload size={24} className="text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-300">{t.studio.mannequinForm.uploadPhoto}</p>
                    <p className="text-gray-500 text-sm mt-1">{t.studio.mannequinForm.uploadHint}</p>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              {analyzing && <p className="text-purple-400 text-xs mt-2 text-center">{t.studio.mannequinForm.analyzing}</p>}
              {analyzedOk && !analyzing && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg px-3 py-1.5 mt-2 inline-block">
                  {t.studio.mannequinForm.autoDetected}
                </div>
              )}
            </label>

            <div className="space-y-4">
              <h4 className="text-white text-sm font-semibold">{t.studio.mannequinForm.basicInfo}</h4>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.studio.mannequinForm.name}</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  placeholder={t.studio.mannequinForm.namePlaceholder}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label={t.studio.mannequinForm.gender} value={formData.gender} options={genderOptions} placeholder={t.studio.mannequinForm.select} onChange={(v) => setFormData({ ...formData, gender: v })} />
                <Select label={t.studio.mannequinForm.ageRange} value={formData.ageRange} options={AGE_OPTIONS} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, ageRange: v })} />
                <Select label={t.studio.mannequinForm.height} value={formData.height} options={HEIGHT_OPTIONS} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, height: v })} />
                <Select label={t.studio.mannequinForm.size} value={formData.size} options={SIZE_OPTIONS} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, size: v })} />
              </div>
              <h4 className="text-white text-sm font-semibold pt-2">{t.studio.mannequinForm.appearance}</h4>
              <div className="grid grid-cols-2 gap-3">
                <Select label={t.studio.mannequinForm.skinTone} value={formData.skinTone} options={skinOptions} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, skinTone: v })} />
                <Select label={t.studio.mannequinForm.hairColor} value={formData.hairColor} options={hairColorOptions} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, hairColor: v })} />
                <Select label={t.studio.mannequinForm.hairLength} value={formData.hairLength} options={hairLengthOptions} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, hairLength: v })} />
                <Select label={t.studio.mannequinForm.eyeColor} value={formData.eyeColor} options={eyeColorOptions} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, eyeColor: v })} />
                <Select label={t.studio.mannequinForm.ethnicity} value={formData.ethnicity} options={ethnicityOptions} placeholder={t.studio.mannequinForm.notSelected} onChange={(v) => setFormData({ ...formData, ethnicity: v })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.studio.mannequinForm.customPrompt}</label>
                <textarea
                  value={formData.customPrompt}
                  onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  rows={3}
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                  placeholder={t.studio.mannequinForm.customPromptPlaceholder}
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <button
                onClick={handleCreateMannequin}
                disabled={creatingMannequin || !formData.name.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
              >
                {creatingMannequin ? t.studio.mannequinForm.submitting : t.studio.mannequinForm.submit}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">{t.studio.mannequin.title}</h1>
        <div className="flex items-center gap-2">
          {step === 1 && (
            <button
              onClick={() => { setFormData(EMPTY_FORM); setPhotoPreview(null); setAnalyzedOk(false); setShowModal(true) }}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              <Plus size={14} /> {t.studio.mannequin.newMannequin}
            </button>
          )}
          {status === 'completed' && (
            <button onClick={downloadZip} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2 rounded-lg transition">
              <Download size={14} /> ZIP
            </button>
          )}
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-6">{t.studio.mannequin.subtitle}</p>

      {error && status !== 'failed' && !showModal && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-500'}`}>{s}</div>
            <span className={`text-sm ${step >= s ? 'text-white' : 'text-gray-600'}`}>
              {s === 1 ? t.studio.mannequin.steps.select : s === 2 ? t.studio.mannequin.steps.upload : t.studio.mannequin.steps.generate}
            </span>
            {s < 3 && <div className={`w-12 h-px ${step > s ? 'bg-purple-500' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          {mannequinsLoading ? (
            <p className="text-gray-500 text-sm">{t.studio.mannequin.loading}</p>
          ) : mannequins.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon size={40} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-6">{t.studio.mannequin.noMannequins}</p>
              <button
                onClick={() => { setFormData(EMPTY_FORM); setPhotoPreview(null); setAnalyzedOk(false); setShowModal(true) }}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg transition"
              >
                <Plus size={16} /> {t.studio.mannequin.createFirst}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {mannequins.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMannequin(m)}
                  className={`bg-[#111111] border rounded-xl p-4 text-left transition ${
                    selectedMannequin?.id === m.id ? 'border-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.2)]' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {m.referencePhotoUrl && (
                    <div className="w-full aspect-[2/3] rounded-lg mb-3 overflow-hidden bg-[#0d0d0d]">
                      <img src={m.referencePhotoUrl} alt={m.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-base font-bold text-white truncate">{m.name}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.gender === 'Kadın' || m.gender === 'Female' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {m.gender}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                      {m.createdFrom === 'photo' ? t.studio.mannequin.fromPhoto : t.studio.mannequin.manual}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{m.height || '-'} • {m.size || '-'}</p>
                </button>
              ))}
            </div>
          )}
          {mannequins.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedMannequin}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition"
              >
                {t.common.next} →
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedMannequin && (
        <div className="max-w-xl">
          <div className="mb-6 bg-[#111111] border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${selectedMannequin.gender === 'Kadın' || selectedMannequin.gender === 'Female' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {selectedMannequin.gender}
            </span>
            <p className="text-white font-medium">{selectedMannequin.name}</p>
          </div>

          <div
            {...productDropzone.getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition mb-4 ${
              productDropzone.isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <input {...productDropzone.getInputProps()} />
            <Upload size={28} className="text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-300">{t.studio.mannequin.uploadProduct}</p>
            <p className="text-xs text-gray-500 mt-1">{t.studio.mannequin.uploadProductHint}</p>
          </div>

          {productFiles.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mb-4">
              {productFiles.map((f, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => setProductFiles((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">{t.studio.mannequin.productName} *</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder={t.studio.mannequin.productNamePlaceholder}
            />
          </div>

          <div
            {...backgroundDropzone.getRootProps()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition mb-6 ${
              backgroundDropzone.isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <input {...backgroundDropzone.getInputProps()} />
            {backgroundFile ? (
              <div className="flex items-center justify-center gap-3">
                <img src={URL.createObjectURL(backgroundFile)} alt="" className="w-16 h-16 object-cover rounded" />
                <button onClick={(e) => { e.stopPropagation(); setBackgroundFile(null) }} className="text-red-400 text-xs hover:text-red-300">
                  {t.studio.mannequin.remove}
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-300">{t.studio.mannequin.backgroundImage} ({t.common.optional})</p>
                <p className="text-xs text-gray-500 mt-1">{t.studio.mannequin.backgroundHint}</p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="border border-white/10 hover:border-white/20 text-gray-400 hover:text-white px-4 py-2.5 rounded-lg text-sm transition">
              ← {t.common.back}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={productFiles.length === 0 || !productName.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition ml-auto"
            >
              {t.common.next} →
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedMannequin && (
        <div className="flex gap-6">
          <div className="w-72 flex-shrink-0 space-y-4">
            <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-500">{t.studio.mannequin.selectedMannequin}</p>
              <p className="text-white font-semibold">{selectedMannequin.name}</p>
              <p className="text-xs text-gray-500 mt-3">{t.studio.mannequin.product}</p>
              <p className="text-white text-sm">{productName}</p>
              <p className="text-xs text-gray-500 mt-3">{productFiles.length} {t.studio.mannequin.productImages}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t.studio.quickSet.quality}</label>
              <div className="flex gap-2">
                {(['1k', '2k', '4k'] as QualityOption[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition ${quality === q ? 'bg-purple-600 border-purple-600 text-white' : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:border-white/20'}`}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t.studio.mannequin.poses}</label>
              <div className="grid grid-cols-2 gap-2">
                {POSE_IDS.map((id) => (
                  <label key={id} className="flex items-center gap-2 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-white/20 transition">
                    <input
                      type="checkbox"
                      checked={selectedPoses.includes(id)}
                      onChange={() => togglePose(id)}
                      className="accent-purple-600"
                    />
                    <span className="text-xs text-gray-300">{getPoseName(id)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
              <span className="text-yellow-400 font-medium">{selectedPoses.length} {t.studio.mannequin.productImages} × 1 = {selectedPoses.length} {t.common.credits}</span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || status === 'processing' || selectedPoses.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading || status === 'processing' ? t.studio.mannequin.generating : t.studio.mannequin.generateButton}
            </button>

            <button onClick={() => setStep(2)} className="w-full border border-white/10 hover:border-white/20 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">
              ← {t.common.back}
            </button>
          </div>

          <div className="flex-1 bg-[#111111] border border-white/10 rounded-2xl p-6">
            {status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center min-h-[400px]">
                <ImageIcon size={32} className="text-gray-600 mb-3" />
                <p className="text-gray-500">{t.studio.quickSet.emptyState}</p>
              </div>
            )}
            {status === 'processing' && (
              <div>
                <p className="text-white font-medium mb-4">{t.studio.mannequin.processing} ({selectedPoses.length})</p>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: selectedPoses.length }).map((_, i) => (
                    <div key={i} className="aspect-[9/16] rounded-xl bg-purple-500/10 animate-pulse" />
                  ))}
                </div>
              </div>
            )}
            {status === 'completed' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-white font-medium">{results.length} {t.studio.mannequin.results}</p>
                  <div className="flex gap-2">
                    <button onClick={downloadZip} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 rounded-lg transition">
                      <Download size={12} /> ZIP
                    </button>
                    <button onClick={reset} className="text-gray-500 hover:text-white text-sm transition">{t.studio.mannequin.newSet}</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {results.map((url, i) => (
                    <div key={i} className="relative group">
                      <ImageZoom
                        src={url}
                        alt={poseNames[i] ?? `${t.studio.mannequin.poseLabel} ${i + 1}`}
                        onClick={() => setLightboxImage(url)}
                        className="w-full aspect-[9/16] rounded-xl overflow-hidden"
                        zoomLevel={2.5}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <p className="text-white text-xs font-medium">{poseNames[i] ?? `${t.studio.mannequin.poseLabel} ${i + 1}`}</p>
                        <a href={url} download={`${productName}-${poseNames[i] ?? `pose-${i + 1}`}.jpg`} className="pointer-events-auto flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg transition" onClick={e => e.stopPropagation()}>
                          <Download size={12} /> {t.common.download}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {status === 'failed' && (
              <div className="h-full flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <p className="text-red-400 font-medium">{t.studio.mannequin.failed}</p>
                  <p className="text-gray-500 text-sm mt-1">{error}</p>
                </div>
                <button onClick={reset} className="text-purple-400 hover:text-purple-300 text-sm">{t.studio.mannequin.tryAgain}</button>
              </div>
            )}
          </div>
        </div>
      )}
      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        onDownload={lightboxImage ? () => { const i = results.indexOf(lightboxImage); const a = document.createElement('a'); a.href = lightboxImage; a.download = `${productName}-${poseNames[i] ?? `pose-${i + 1}`}.jpg`; a.click() } : undefined}
      />
    </div>
  )
}

function Select({ label, value, options, placeholder, onChange }: { label: string; value: string; options: string[]; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function MannequinStudioPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 p-8 animate-pulse" />}>
      <MannequinStudioInner />
    </Suspense>
  )
}
