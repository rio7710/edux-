-- CreateTable
CREATE TABLE "TableColumnConfig" (
    "id" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "customLabel" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "width" INTEGER,
    "fixed" TEXT,
    "ownerType" TEXT NOT NULL DEFAULT 'global',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableColumnConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableColumnConfig_tableKey_columnKey_ownerType_ownerId_key" ON "TableColumnConfig"("tableKey", "columnKey", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "TableColumnConfig_tableKey_ownerType_ownerId_idx" ON "TableColumnConfig"("tableKey", "ownerType", "ownerId");