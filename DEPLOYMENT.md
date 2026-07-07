# Posemod Production Deployment

Posemod, AI destekli ürün görseli üretim SaaS uygulamasıdır. Production hedefi iki Cloud Run servisidir:

- `posemod-web`: Next.js web/API servisi
- `posemod-worker`: BullMQ `image-generation` kuyruğunu tüketen worker

## Gereken Servisler

- Google Cloud Run
- Artifact Registry
- Secret Manager
- Google Cloud Storage
- Vertex AI
- Neon PostgreSQL
- Upstash Redis
- PayTR iFrame API
- Hostinger DNS

## Local Çalıştırma

```bash
npm install
npx prisma generate
npm run dev
```

Local için `.env` oluşturun. Secret değerlerini repoya yazmayın. Örnekler için `.env.example` dosyasını kullanın.

## Env Değişkenleri

Zorunlu production secret değerleri:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`
- `GCS_BUCKET_NAME`

Zorunlu production config değerleri:

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL=https://posemod.com`
- `GOOGLE_PROJECT_ID=YOUR_GCP_PROJECT_ID`
- `GOOGLE_LOCATION=us-central1`
- `PAYTR_SUCCESS_URL=https://posemod.com/payment/success`
- `PAYTR_FAIL_URL=https://posemod.com/payment/fail`
- `PAYTR_CALLBACK_URL=https://posemod.com/api/payments/paytr/callback`
- `RATE_LIMIT_ENABLED=true`

## Secret Manager

Örnek secret oluşturma:

```bash
printf '%s' 'postgresql://USER:PASSWORD@HOST/DB?sslmode=require' | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' 'rediss://default:PASSWORD@HOST:PORT' | gcloud secrets create REDIS_URL --data-file=-
printf '%s' 'replace-with-strong-random-secret' | gcloud secrets create JWT_SECRET --data-file=-
printf '%s' 'your-paytr-merchant-id' | gcloud secrets create PAYTR_MERCHANT_ID --data-file=-
printf '%s' 'your-paytr-merchant-key' | gcloud secrets create PAYTR_MERCHANT_KEY --data-file=-
printf '%s' 'your-paytr-merchant-salt' | gcloud secrets create PAYTR_MERCHANT_SALT --data-file=-
printf '%s' 'posemod-prod-assets' | gcloud secrets create GCS_BUCKET_NAME --data-file=-
```

Cloud Run runtime service account için izinler:

```bash
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:posemod-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:posemod-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:posemod-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Database Migration ve Seed

Production’da `db push` yerine migration deploy kullanın:

```bash
npx prisma generate
npm run db:migrate
ADMIN_EMAIL=admin@posemod.com ADMIN_PASSWORD=change-this-password ADMIN_NAME="Posemod Admin" npm run db:seed
```

Seed idempotent çalışır: sistem mankenlerini upsert eder ve env verilirse admin kullanıcıyı `ADMIN` rolüne çeker.

## Docker Build

```bash
docker build -t posemod:local .
docker run --rm -p 8080:8080 --env-file .env posemod:local
```

## Cloud Run Deploy

Hazır script:

```bash
PROJECT_ID=YOUR_GCP_PROJECT_ID REGION=us-central1 ./scripts/deploy-cloud-run.sh
```

Web servis manuel deploy:

```bash
gcloud run deploy posemod-web \
  --image us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/posemod/posemod:latest \
  --region us-central1 \
  --service-account posemod-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10
```

Worker servis manuel deploy:

```bash
gcloud run deploy posemod-worker \
  --image us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/posemod/posemod:latest \
  --region us-central1 \
  --service-account posemod-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --command npm \
  --args run,worker \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 2
```

Worker sürekli Redis kuyruğu tükettiği için `min-instances=1` önerilir.

## Google Cloud Storage

Bucket:

```bash
gcloud storage buckets create gs://posemod-prod-assets --location=us-central1
```

Kısa vadede output URL’leri public GCS URL olarak üretilir. Bucket public yapılacaksa yalnızca `outputs/` prefix’i için kontrollü IAM/CORS tercih edin. Daha güvenli uzun vadeli yol signed URL modelidir.

CORS örneği:

```json
[
  {
    "origin": ["https://posemod.com", "https://www.posemod.com"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

```bash
gcloud storage buckets update gs://posemod-prod-assets --cors-file=cors.json
```

## Domain ve Hostinger DNS

1. Cloud Run `posemod-web` deploy edilir.
2. Cloud Run domain mapping ekranında `posemod.com` ve `www.posemod.com` için mapping oluşturulur.
3. Google’ın verdiği `resourceRecords` değerleri Hostinger DNS’e birebir girilir.
4. SSL provisioning 15 dakika ile 24 saat arası sürebilir.
5. Tercih edilen canonical domain `https://posemod.com`; `www.posemod.com` uzun vadede `posemod.com` adresine yönlendirilmelidir.

Cloud Run domain mapping preview/limitleri sorun çıkarırsa production için Firebase Hosting veya Global External Application Load Balancer daha kontrollü alternatiftir.

## PayTR Panel Ayarları

- Callback URL: `https://posemod.com/api/payments/paytr/callback`
- Success URL: `https://posemod.com/payment/success`
- Fail URL: `https://posemod.com/payment/fail`

Callback public olmalıdır; session/auth istemez. Backend hash doğrular ve PayTR’ye yalnızca düz `OK` döner.

## Health Check

```bash
curl https://posemod.com/api/health
```

Beklenen başarılı response:

```json
{
  "status": "ok",
  "app": "posemod",
  "env": "production",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok",
    "vertexConfig": "ok"
  }
}
```

## Production Test Checklist

Auth:

- Register çalışıyor.
- Login çalışıyor.
- Logout çalışıyor.
- Yanlış şifre 401 dönüyor.
- Duplicate email engelleniyor.
- Dashboard auth guard çalışıyor.

Admin:

- USER `/admin` API’lerinden 403 alıyor.
- ADMIN `/admin` sayfasına girebiliyor.
- Kullanıcı listesi geliyor.
- Manuel kredi ekleme/düşme transaction yazıyor.

Payment:

- Paketler `/pricing` altında görünüyor.
- PayTR create endpoint iframe token üretiyor.
- Callback hash doğruluyor.
- Success callback kredi yüklüyor.
- Duplicate callback ikinci kez kredi yüklemiyor.
- Failed callback kredi yüklemiyor.

Credits:

- Generation başlayınca kredi reserve oluyor.
- Başarılı generation usage transaction yazıyor.
- Başarısız generation refund transaction yazıyor.
- Yetersiz kredi generation başlatmıyor.

AI ve Worker:

- Quick set çalışıyor.
- Mannequin set çalışıyor.
- Remove BG/ecommerce route’ları job oluşturuyor.
- Output görseller GCS’ye gidiyor.
- Worker Redis job alıyor.
- Worker crash/retry davranışı Cloud Run loglarında izleniyor.

Deployment:

- `/api/health` ok veya açıklayıcı degraded dönüyor.
- `posemod.com` açılıyor.
- `www.posemod.com` açılıyor veya redirect oluyor.
- SSL aktif.
- Cloud Run logs secret içermiyor.

## Rollback

Son stabil revision’a dönmek:

```bash
gcloud run services update-traffic posemod-web --region us-central1 --to-revisions REVISION_NAME=100
gcloud run services update-traffic posemod-worker --region us-central1 --to-revisions REVISION_NAME=100
```

Önceki image tag’i ile tekrar deploy:

```bash
gcloud run deploy posemod-web --image us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/posemod/posemod:PREVIOUS_TAG --region us-central1
gcloud run deploy posemod-worker --image us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/posemod/posemod:PREVIOUS_TAG --region us-central1 --command npm --args run,worker
```

## Sorun Giderme

- DB bağlantısı: `DATABASE_URL` Neon SSL parametresini kontrol edin.
- Redis bağlantısı: Upstash URL `rediss://` olmalı.
- Vertex permission: Cloud Run service account `roles/aiplatform.user` almalı.
- PayTR callback gelmiyor: Panel URL’si, public erişim ve response body’nin sadece `OK` olduğunu kontrol edin.
- GCS permission: service account `roles/storage.objectAdmin` almalı.
- Cloud Run port hatası: web servisi `PORT=8080` ve container port `8080` kullanır.
- Prisma migrate hatası: önce `npx prisma generate`, sonra `npm run db:migrate` çalıştırın.
