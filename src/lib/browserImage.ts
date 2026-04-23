function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function toVertexCompatibleDataUrl(file: File): Promise<string> {
  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    return readFileAsDataUrl(file)
  }

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Görsel işlenemedi')
  }

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return canvas.toDataURL('image/png')
}
