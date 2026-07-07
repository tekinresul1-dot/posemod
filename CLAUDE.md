# Posemod

## Proje
E-ticaret satıcıları için AI destekli ürün görseli üretim SaaS. localhost:3000

## Stack
- Next.js 16 + TypeScript + Tailwind
- PostgreSQL (Docker, port 5434)
- Redis (port 6379)
- BullMQ worker: src/worker/index.ts
- Vertex AI Imagen (GCP proje: YOUR_GCP_PROJECT_ID)
- JWT auth (httpOnly cookie + legacy localStorage fallback)

## Başlatma
npm run dev + npm run worker (ikisi aynı anda)

## Kritik Dosyalar
- src/lib/imagen.ts → Vertex AI client
- src/lib/credits.ts → kredi sistemi
- src/lib/queue.ts → BullMQ
- src/worker/processors/quickSet.ts → görsel üretim
- .env → tüm API anahtarları

## Kurallar
- Dosyaları gereksiz okuma, sadece değiştirilecek olanı oku
- Hiçbir şey için kullanıcıya sorma
- Her zaman --dangerously-skip-permissions ile çalış
- Token tasarrufu için önce CLAUDE.md oku, sonra işe başla
