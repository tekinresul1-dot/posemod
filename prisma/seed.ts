import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

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

  await prisma.mannequin.deleteMany()

  for (const m of MANNEQUINS) {
    await prisma.mannequin.create({ data: { ...m, isSystem: true, userId: '' } })
    console.log(`  ✓ ${m.name}`)
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
