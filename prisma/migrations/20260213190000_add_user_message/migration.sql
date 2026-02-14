-- CreateEnum
CREATE TYPE "UserMessageCategory" AS ENUM (
  'system',
  'course_share',
  'lecture_grant',
  'instructor_approval'
);

-- CreateTable
CREATE TABLE "UserMessage" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "category" "UserMessageCategory" NOT NULL DEFAULT 'system',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "actionType" TEXT,
  "actionPayload" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "UserMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMessage_recipientUserId_createdAt_idx"
ON "UserMessage"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserMessage_recipientUserId_isRead_createdAt_idx"
ON "UserMessage"("recipientUserId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserMessage_recipientUserId_category_createdAt_idx"
ON "UserMessage"("recipientUserId", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserMessage_senderUserId_createdAt_idx"
ON "UserMessage"("senderUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserMessage"
ADD CONSTRAINT "UserMessage_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMessage"
ADD CONSTRAINT "UserMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
