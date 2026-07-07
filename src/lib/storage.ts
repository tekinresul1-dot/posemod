import fs from 'fs/promises'
import path from 'path'
import { Storage } from '@google-cloud/storage'
import { isProduction, requireProductionEnv } from './env'

let storage: Storage | null = null

function getStorageClient() {
  storage ??= new Storage()
  return storage
}

function getBucketName() {
  return requireProductionEnv('GCS_BUCKET_NAME') ?? process.env.GCS_BUCKET_NAME
}

function publicUrlFor(objectName: string) {
  const baseUrl = process.env.GCS_PUBLIC_BASE_URL
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${objectName}`
  const bucketName = getBucketName()
  return `https://storage.googleapis.com/${bucketName}/${objectName}`
}

function localGenerationUrl(jobId: string, filename: string) {
  return `/generations/${jobId}/${filename}`
}

export async function saveInputImage(
  buffer: Buffer,
  jobId: string,
  filename: string,
  contentType: string
): Promise<string> {
  const bucketName = getBucketName()
  if (bucketName) {
    const objectName = `inputs/${jobId}/${filename}`
    await getStorageClient().bucket(bucketName).file(objectName).save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=86400' },
    })
    return publicUrlFor(objectName)
  }

  if (isProduction()) throw new Error('GCS_BUCKET_NAME production ortamında zorunludur')

  const dir = path.join(process.cwd(), 'public', 'generations', jobId)
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)
  return filePath
}

export async function saveImage(
  buffer: Buffer,
  jobId: string,
  poseIndex: number
): Promise<string> {
  const bucketName = getBucketName()
  const filename = `pose-${poseIndex}.jpg`

  if (bucketName) {
    const objectName = `outputs/${jobId}/${filename}`
    await getStorageClient().bucket(bucketName).file(objectName).save(buffer, {
      contentType: 'image/jpeg',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
    return publicUrlFor(objectName)
  }

  if (isProduction()) throw new Error('GCS_BUCKET_NAME production ortamında zorunludur')

  const dir = path.join(process.cwd(), 'public', 'generations', jobId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, filename), buffer)

  return localGenerationUrl(jobId, filename)
}

export async function loadImageAsBase64(location: string | null): Promise<string | null> {
  if (!location) return null

  if (location.startsWith('http://') || location.startsWith('https://')) {
    const res = await fetch(location)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer).toString('base64')
  }

  try {
    const buf = await fs.readFile(location)
    return buf.toString('base64')
  } catch {
    return null
  }
}
