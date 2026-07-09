#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-YOUR_GCP_PROJECT_ID}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-posemod}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/posemod:latest"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-posemod-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com storage.googleapis.com

gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "${REPOSITORY}" --repository-format=docker --location "${REGION}"

gcloud builds submit --tag "${IMAGE}"

SECRET_ENV="DATABASE_URL=DATABASE_URL,REDIS_URL=REDIS_URL,JWT_SECRET=JWT_SECRET,PAYTR_MERCHANT_ID=PAYTR_MERCHANT_ID,PAYTR_MERCHANT_KEY=PAYTR_MERCHANT_KEY,PAYTR_MERCHANT_SALT=PAYTR_MERCHANT_SALT,GCS_BUCKET_NAME=GCS_BUCKET_NAME"
COMMON_ENV="NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://posemod.com,GOOGLE_PROJECT_ID=${PROJECT_ID},GOOGLE_LOCATION=${REGION},PAYTR_TEST_MODE=1,PAYTR_SUCCESS_URL=https://posemod.com/payment/success,PAYTR_FAIL_URL=https://posemod.com/payment/fail,PAYTR_CALLBACK_URL=https://posemod.com/api/payments/paytr/callback,RATE_LIMIT_ENABLED=true"

gcloud run deploy posemod-web \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "${COMMON_ENV}" \
  --set-secrets "${SECRET_ENV}"

gcloud run deploy posemod-worker \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --no-allow-unauthenticated \
  --command npm \
  --args run,worker \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 2 \
  --set-env-vars "${COMMON_ENV}" \
  --set-secrets "${SECRET_ENV}"
