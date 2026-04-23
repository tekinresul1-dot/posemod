export interface ImageFormat {
  id: string
  name: string
  nameEn: string
  width: number
  height: number
  aspectRatio: string
  icon?: string
}

export const IMAGE_FORMATS: ImageFormat[] = [
  { id: 'trendyol', name: 'Trendyol', nameEn: 'Trendyol', width: 1200, height: 1800, aspectRatio: '2:3', icon: '🛍️' },
  { id: 'instagram_post', name: 'Instagram Post', nameEn: 'Instagram Post', width: 1080, height: 1350, aspectRatio: '4:5', icon: '📸' },
  { id: 'instagram_square', name: 'Instagram Kare', nameEn: 'Instagram Square', width: 1080, height: 1080, aspectRatio: '1:1', icon: '⬜' },
  { id: 'facebook', name: 'Facebook', nameEn: 'Facebook', width: 1200, height: 630, aspectRatio: '16:9', icon: '👥' },
  { id: 'linkedin', name: 'LinkedIn', nameEn: 'LinkedIn', width: 1200, height: 1200, aspectRatio: '1:1', icon: '💼' },
  { id: 'pinterest', name: 'Pinterest', nameEn: 'Pinterest', width: 1000, height: 1500, aspectRatio: '2:3', icon: '📌' },
  { id: 'custom', name: 'Özel Boyut', nameEn: 'Custom Size', width: 0, height: 0, aspectRatio: 'custom', icon: '⚙️' },
]

export function getClosestAspectRatio(width: number, height: number): '1:1' | '3:4' | '4:3' | '16:9' | '9:16' {
  if (!width || !height) return '9:16'
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.1) return '1:1'
  if (Math.abs(ratio - 16 / 9) < 0.15) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.12) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.12) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.12) return '3:4'
  if (Math.abs(ratio - 2 / 3) < 0.12) return '3:4'
  return width > height ? '16:9' : '9:16'
}
