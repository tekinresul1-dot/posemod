import fs from 'fs/promises'
import path from 'path'
import type { Generation, Mannequin, User } from '@prisma/client'

type DevStore = {
  users: User[]
  generations: Generation[]
  mannequins: Mannequin[]
}

const STORE_DIR = path.join(process.cwd(), '.dev-data')
const STORE_FILE = path.join(STORE_DIR, 'store.json')

function defaultMannequin(partial: Pick<Mannequin, 'id' | 'name' | 'gender' | 'ethnicity' | 'previewUrl'>): Mannequin {
  return {
    id: partial.id,
    name: partial.name,
    gender: partial.gender,
    ethnicity: partial.ethnicity,
    previewUrl: partial.previewUrl,
    userId: '',
    prompt: '',
    ageRange: null,
    height: null,
    size: null,
    skinTone: null,
    hairColor: null,
    hairLength: null,
    eyeColor: null,
    customPrompt: null,
    referencePhotoUrl: null,
    backgroundUrl: null,
    poseData: null,
    createdFrom: 'manual',
    isSystem: true,
    createdAt: new Date(),
  }
}

const DEFAULT_MANNEQUINS: Mannequin[] = [
  defaultMannequin({ id: 'm_zeynep', name: 'Zeynep', gender: 'female', ethnicity: 'Turkish woman', previewUrl: '/mannequins/zeynep.svg' }),
  defaultMannequin({ id: 'm_ayse', name: 'Ayşe', gender: 'female', ethnicity: 'Turkish woman', previewUrl: '/mannequins/ayse.svg' }),
  defaultMannequin({ id: 'm_mia', name: 'Mia', gender: 'female', ethnicity: 'European woman', previewUrl: '/mannequins/mia.svg' }),
  defaultMannequin({ id: 'm_sophie', name: 'Sophie', gender: 'female', ethnicity: 'European woman', previewUrl: '/mannequins/sophie.svg' }),
  defaultMannequin({ id: 'm_zoe', name: 'Zoe', gender: 'female', ethnicity: 'African-American woman', previewUrl: '/mannequins/zoe.svg' }),
  defaultMannequin({ id: 'm_ahmet', name: 'Ahmet', gender: 'male', ethnicity: 'Turkish man', previewUrl: '/mannequins/ahmet.svg' }),
]

function now() {
  return new Date()
}

async function ensureStore() {
  await fs.mkdir(STORE_DIR, { recursive: true })

  try {
    await fs.access(STORE_FILE)
  } catch {
    const initial: DevStore = {
      users: [],
      generations: [],
      mannequins: DEFAULT_MANNEQUINS,
    }
    await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2))
  }
}

async function readStore(): Promise<DevStore> {
  await ensureStore()
  const raw = await fs.readFile(STORE_FILE, 'utf8')
  const parsed = JSON.parse(raw) as DevStore
  parsed.users ??= []
  parsed.generations ??= []
  parsed.mannequins ??= DEFAULT_MANNEQUINS
  return parsed
}

async function writeStore(store: DevStore) {
  await ensureStore()
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2))
}

export async function getDevUserById(id: string): Promise<User | null> {
  const store = await readStore()
  return store.users.find((user) => user.id === id) ?? null
}

export async function getDevUserByEmail(email: string): Promise<User | null> {
  const store = await readStore()
  return store.users.find((user) => user.email === email) ?? null
}

export async function createDevUser(data: {
  id?: string
  email: string
  name: string | null
  passwordHash: string
  credits?: number
}): Promise<User> {
  const store = await readStore()
  const user: User = {
    id: data.id ?? crypto.randomUUID(),
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    credits: data.credits ?? 3,
    pendingCredits: 0,
    plan: 'free',
    createdAt: now(),
  }

  store.users.push(user)
  await writeStore(store)
  return user
}

export async function ensureDevUser(id: string): Promise<User> {
  const existing = await getDevUserById(id)
  if (existing) return existing

  return createDevUser({
    id,
    email: `${id}@local.dev`,
    name: 'Local User',
    passwordHash: '',
    credits: 999,
  })
}

export async function updateDevUser(id: string, updater: (user: User) => User): Promise<User> {
  const store = await readStore()
  const index = store.users.findIndex((user) => user.id === id)
  const base = index >= 0 ? store.users[index] : await ensureDevUser(id)
  const next = updater(base)

  if (index >= 0) {
    store.users[index] = next
  } else {
    store.users.push(next)
  }

  await writeStore(store)
  return next
}

export async function createDevGeneration(data: Omit<Generation, 'id' | 'createdAt' | 'completedAt'> & { id?: string; createdAt?: Date; completedAt?: Date | null }): Promise<Generation> {
  const store = await readStore()
  const generation: Generation = {
    ...data,
    id: data.id ?? crypto.randomUUID(),
    createdAt: data.createdAt ?? now(),
    completedAt: data.completedAt ?? null,
  }

  store.generations.push(generation)
  await writeStore(store)
  return generation
}

export async function updateDevGeneration(jobId: string, updater: (generation: Generation) => Generation): Promise<Generation> {
  const store = await readStore()
  const index = store.generations.findIndex((generation) => generation.jobId === jobId)
  if (index < 0) {
    throw new Error(`Generation not found for jobId ${jobId}`)
  }

  const next = updater(store.generations[index])
  store.generations[index] = next
  await writeStore(store)
  return next
}

export async function getDevGenerationByJobId(jobId: string): Promise<Generation | null> {
  const store = await readStore()
  return store.generations.find((generation) => generation.jobId === jobId) ?? null
}

export async function listDevGenerationsByUserId(userId: string): Promise<Generation[]> {
  const store = await readStore()
  return store.generations
    .filter((generation) => generation.userId === userId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export async function getDevMannequins(): Promise<Mannequin[]> {
  const store = await readStore()
  return [...store.mannequins].sort((a, b) => a.name.localeCompare(b.name))
}
