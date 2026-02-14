ALTER TABLE "Template"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Template_deletedAt_idx" ON "Template"("deletedAt");
