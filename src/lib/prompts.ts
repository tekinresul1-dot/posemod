export const HUMAN_REALISM_SUFFIX_EN = `
ULTRA REALISTIC HUMAN REQUIREMENTS:
- Photorealistic real human being, NOT AI-generated looking
- Natural skin texture with visible pores, subtle imperfections, and real skin details
- Authentic facial features with asymmetry (real faces are never perfectly symmetrical)
- Natural skin tone variations, subtle freckles, natural blemishes where appropriate
- Real human eyes with natural reflections, authentic iris patterns
- Natural hair with individual strands, flyaways, realistic texture
- Authentic body proportions, realistic anatomy
- Natural pose with subtle imperfections (slight weight shift, natural muscle tension)
- Professional fashion editorial quality, like DSLR photography
- Shot on full-frame camera, 85mm lens, f/2.8, natural depth of field
- Soft natural studio lighting with realistic shadows
- NO plastic skin, NO over-smoothed features, NO uncanny valley effect
- NO AI artifacts, NO overly perfect symmetry, NO airbrushed look
- Looks like a real professional photograph of a real person`

export const HUMAN_REALISM_SUFFIX_TR = `
ULTRA GERÇEKÇİ İNSAN GEREKSİNİMLERİ:
- Fotoğraf gerçekçiliğinde gerçek insan, YAPAY ZEKA görünümlü DEĞİL
- Doğal cilt dokusu, görünür gözenekler, hafif kusurlar ve gerçek cilt detayları
- Otantik yüz özellikleri, doğal asimetri (gerçek yüzler asla mükemmel simetrik değildir)
- Doğal ten rengi geçişleri, hafif çiller, doğal pürüzler uygun yerlerde
- Gerçek insan gözleri, doğal ışık yansımaları, otantik iris desenleri
- Doğal saç, ayrı ayrı teller, dağınık tutamlar, gerçekçi doku
- Otantik vücut oranları, gerçekçi anatomi
- Doğal poz, hafif kusurlar (ağırlık kayması, doğal kas gerginliği)
- Profesyonel moda editoryal kalitesi, DSLR fotoğraf gibi
- Full-frame kamera, 85mm lens, f/2.8, doğal alan derinliği
- Yumuşak doğal stüdyo ışığı, gerçekçi gölgeler
- Plastik cilt YOK, aşırı pürüzsüz yüz YOK, uncanny valley etkisi YOK
- Yapay zeka izleri YOK, aşırı mükemmel simetri YOK, airbrush görünüm YOK
- Gerçek bir insanın gerçek profesyonel fotoğrafı gibi görünmeli`

export const NEGATIVE_REALISM = `plastic skin, airbrushed, over-smoothed, perfect symmetry, CGI, 3D render, uncanny valley, doll-like, waxy skin, AI artifacts, generated look, fake looking, unnatural, digital painting, illustration, cartoon, overly perfect features, mannequin-like face, dead eyes, plastic hair`

export function getCompositionRule(width: number, height: number): string {
  const ratio = width / height
  if (ratio < 0.95) {
    return 'Product centered and large, filling 80-85% of the frame vertically. Balanced top and bottom padding. Product must be fully visible, no cropping.'
  } else if (ratio > 1.05) {
    return 'Product centered but slightly smaller (60-70% of frame). Balanced left and right padding for text area. Product must be fully visible, no cropping.'
  } else {
    return 'Product perfectly centered. Balanced padding on all sides. Product must be fully visible, no cropping.'
  }
}

export const GLOBAL_NEGATIVE_PROMPT = `different product, modified garment, different color, different pattern,
different buttons, different collar, altered fabric, color variation,
blurry, deformed, watermark, text, logo`

export const QUICK_SET_POSES = [
  {
    id: 1,
    name: 'Stüdyo Ön',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: front view, centered composition, soft studio lighting.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, pure white studio background, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
  {
    id: 2,
    name: 'Stüdyo 45°',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: 45 degree angle view, dramatic side lighting.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, pure white studio background, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
  {
    id: 3,
    name: 'Flat Lay',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: top-down overhead view, light gray background, minimalist.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
  {
    id: 4,
    name: 'Yaşam Tarzı',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: lifestyle context, warm ambient lighting, editorial style.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, pure white studio background, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
  {
    id: 5,
    name: 'Detay',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: extreme macro close-up showing texture and fabric quality.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, pure white studio background, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
  {
    id: 6,
    name: 'Dark Minimal',
    build: (productName: string, customPrompt?: string) =>
      `Edit the provided reference image. DO NOT create a new product.\n` +
      `Keep this exact product identical: same color, pattern, fabric, design, buttons, details.\n` +
      `Only change the camera angle/pose to: dark charcoal background, single dramatic spotlight, luxury feel.\n` +
      (customPrompt ? `${customPrompt}\n` : '') +
      `Professional e-commerce product photography, 9:16 portrait ratio, 8k quality, sharp focus.`,
  },
]

export const ECOMMERCE_POSES = [
  {
    id: 1,
    name: 'Beyaz Zemin Ön',
    build: (p: string) =>
      `Professional Trendyol e-commerce photo of ${p}, pure white background, front view centered, soft studio lighting, sharp focus, commercial standard`,
  },
  {
    id: 2,
    name: 'Beyaz Zemin 45°',
    build: (p: string) =>
      `Trendyol product photo of ${p}, white background, 45 degree angle, all product details visible, professional studio lighting`,
  },
  {
    id: 3,
    name: 'Arka Görünüm',
    build: (p: string) =>
      `Trendyol e-commerce photo of ${p}, pure white background, back view, studio lighting, sharp focus`,
  },
  {
    id: 4,
    name: 'Detay Shot',
    build: (p: string) =>
      `Close-up detail macro shot of ${p}, white background, texture and material clearly visible, studio lighting`,
  },
  {
    id: 5,
    name: 'Flat Lay',
    build: (p: string) =>
      `Trendyol flat lay photo of ${p}, white background, top-down view, clean professional presentation`,
  },
  {
    id: 6,
    name: 'Lifestyle',
    build: (p: string) =>
      `Lifestyle photo of ${p}, natural environment, warm lighting, Trendyol marketplace editorial style`,
  },
]

export const MANNEQUIN_SET_POSES = [
  {
    id: 'front',
    name: 'Ön',
    poseDesc: 'model standing straight facing camera, full body, arms relaxed',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model standing straight facing camera, full body, arms relaxed\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
  {
    id: 'back',
    name: 'Arka',
    poseDesc: 'model turned around, back facing camera, full body visible',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model turned around, back facing camera, full body visible\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
  {
    id: 'right',
    name: 'Sağ Profil',
    poseDesc: 'model turned 90 degrees right, side view',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model turned 90 degrees right, side view\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
  {
    id: 'left',
    name: 'Sol Profil',
    poseDesc: 'model turned 90 degrees left, side view',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model turned 90 degrees left, side view\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
  {
    id: 'angle45right',
    name: '45° Sağ',
    poseDesc: 'model at 45 degree angle to the right, three-quarter view',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model at 45 degree angle to the right, three-quarter view\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
  {
    id: 'angle45left',
    name: '45° Sol',
    poseDesc: 'model at 45 degree angle to the left, three-quarter view',
    build: (mannequinPrompt: string, backgroundClause: string) =>
      `Put the exact garment from the reference image on the model.\n` +
      `Product fidelity is critical: same color, pattern, fabric, buttons, collar, all details identical.\n` +
      `Model: ${mannequinPrompt}\n` +
      `Pose: model at 45 degree angle to the left, three-quarter view\n` +
      `Background: ${backgroundClause}\n` +
      `Professional fashion photography, 9:16 portrait ratio, 8k quality.`,
  },
]

export function buildRefPrompt(posePrompt: string, productName: string): string {
  return (
    `Create an image about ${productName} [1] to match the description. ` +
    `Keep identical product shape, color, design, and material from reference image [1]. ` +
    posePrompt.replaceAll(productName, `${productName} [1]`)
  )
}
