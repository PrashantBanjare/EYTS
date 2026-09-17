-- CreateEnum
CREATE TYPE "ProctoringMode" AS ENUM ('OFF', 'BROWSER_ONLY', 'FACE_DETECTION', 'FULL_RECORDING');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "proctoringMode" "ProctoringMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "requireParentalConsent" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "proctoringMode" "ProctoringMode" NOT NULL DEFAULT 'OFF';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentWaived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proctoringOverride" "ProctoringMode";

-- CreateTable
CREATE TABLE "ParentalConsent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "relationship" TEXT,
    "otp" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringSnapshot" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,

    CONSTRAINT "ProctoringSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentalConsent_studentId_key" ON "ParentalConsent"("studentId");

-- CreateIndex
CREATE INDEX "ParentalConsent_verified_idx" ON "ParentalConsent"("verified");

-- CreateIndex
CREATE INDEX "ProctoringEvent_attemptId_idx" ON "ProctoringEvent"("attemptId");

-- CreateIndex
CREATE INDEX "ProctoringEvent_eventType_idx" ON "ProctoringEvent"("eventType");

-- CreateIndex
CREATE INDEX "ProctoringSnapshot_attemptId_idx" ON "ProctoringSnapshot"("attemptId");

-- CreateIndex
CREATE INDEX "ProctoringSnapshot_flagged_idx" ON "ProctoringSnapshot"("flagged");

-- AddForeignKey
ALTER TABLE "ParentalConsent" ADD CONSTRAINT "ParentalConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringSnapshot" ADD CONSTRAINT "ProctoringSnapshot_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
