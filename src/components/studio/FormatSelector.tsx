'use client'
import { IMAGE_FORMATS, ImageFormat } from '@/lib/imageFormats'
import { useLanguage } from '@/context/LanguageContext'

interface Props {
  selectedFormat: ImageFormat
  customWidth: number
  customHeight: number
  onFormatChange: (format: ImageFormat) => void
  onCustomChange: (w: number, h: number) => void
  compact?: boolean
}

export function FormatSelector({ selectedFormat, customWidth, customHeight, onFormatChange, onCustomChange, compact }: Props) {
  const { language, t } = useLanguage()
  const isCustom = selectedFormat.id === 'custom'

  return (
    <div className={compact ? 'space-y-0' : 'space-y-3'}>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.studio.quickSet.format.label}</label>

      <div className={compact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-3 gap-2'}>
        {IMAGE_FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            onClick={() => onFormatChange(format)}
            className={`rounded-lg border text-left transition-colors ${
              compact ? 'p-2' : 'p-3'
            } ${
              selectedFormat.id === format.id
                ? 'border-purple-500 bg-purple-500/10 text-white'
                : 'border-white/10 bg-zinc-900 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className={compact ? 'text-sm mb-0.5' : 'text-lg mb-1'}>{format.icon}</div>
            <div className={compact ? 'text-[11px] font-medium leading-tight' : 'text-xs font-medium'}>
              {language === 'tr' ? format.name : format.nameEn}
            </div>
            {format.id !== 'custom' && (
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {format.width}×{format.height}
              </div>
            )}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="space-y-2 p-3 rounded-lg bg-[#0d0d0d] border border-white/10">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">{t.studio.quickSet.format.customWidth}</label>
              <input
                type="number"
                min="512"
                max="4096"
                step="8"
                value={customWidth || ''}
                onChange={(e) => onCustomChange(parseInt(e.target.value) || 0, customHeight)}
                placeholder="1200"
                className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t.studio.quickSet.format.customHeight}</label>
              <input
                type="number"
                min="512"
                max="4096"
                step="8"
                value={customHeight || ''}
                onChange={(e) => onCustomChange(customWidth, parseInt(e.target.value) || 0)}
                placeholder="1800"
                className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">{t.studio.quickSet.format.customHint}</p>
        </div>
      )}
    </div>
  )
}
