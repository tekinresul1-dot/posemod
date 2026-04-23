import fs from 'fs/promises'
import path from 'path'

export async function saveImage(
  buffer: Buffer,
  jobId: string,
  poseIndex: number
): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'generations', jobId)
  await fs.mkdir(dir, { recursive: true })

  const filename = `pose-${poseIndex}.jpg`
  await fs.writeFile(path.join(dir, filename), buffer)

  return `/generations/${jobId}/${filename}`
}
