import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

const MANNEQUINS = [
  { name: 'Zeynep', gender: 'female', ethnicity: 'Turkish woman', previewUrl: '/mannequins/zeynep.svg' },
  { name: 'Ayşe', gender: 'female', ethnicity: 'Turkish woman', previewUrl: '/mannequins/ayse.svg' },
  { name: 'Mia', gender: 'female', ethnicity: 'European woman', previewUrl: '/mannequins/mia.svg' },
  { name: 'Sophie', gender: 'female', ethnicity: 'European woman', previewUrl: '/mannequins/sophie.svg' },
  { name: 'Zoe', gender: 'female', ethnicity: 'African-American woman', previewUrl: '/mannequins/zoe.svg' },
  { name: 'Ahmet', gender: 'male', ethnicity: 'Turkish man', previewUrl: '/mannequins/ahmet.svg' },
]

async function main() {
  console.log('Seeding mannequins...')

  for (const m of MANNEQUINS) {
    await prisma.mannequin.upsert({
      where: { id: `system-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: { ...m, isSystem: true, userId: '' },
      create: {
        id: `system-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        ...m,
        isSystem: true,
        userId: '',
      },
    })
    console.log(`  seeded ${m.name}`)
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
    await prisma.user.upsert({
      where: { email: process.env.ADMIN_EMAIL.trim().toLowerCase() },
      update: {
        role: 'ADMIN',
        name: process.env.ADMIN_NAME ?? 'Posemod Admin',
      },
      create: {
        email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
        name: process.env.ADMIN_NAME ?? 'Posemod Admin',
        passwordHash,
        role: 'ADMIN',
        credits: 100,
      },
    })
    console.log('Admin user ensured')
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
