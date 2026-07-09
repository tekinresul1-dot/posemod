CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'success', 'failed', 'cancelled');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

ALTER TABLE "CreditTransaction" ADD COLUMN "metadata" JSONB;

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'paytr',
  "merchantOid" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "amountTRY" DOUBLE PRECISION NOT NULL,
  "credits" DOUBLE PRECISION NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "rawCallback" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditTransaction_type_reference_key" ON "CreditTransaction"("type", "reference");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE UNIQUE INDEX "Payment_merchantOid_key" ON "Payment"("merchantOid");
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
