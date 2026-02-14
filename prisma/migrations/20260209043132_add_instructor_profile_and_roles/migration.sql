/*
  Warnings:

  - You are about to drop the `CourseModule` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

-- First, add enum values one by one
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'operator' BEFORE 'editor';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'instructor' BEFORE 'viewer';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'guest';

-- DropForeignKey
ALTER TABLE IF EXISTS "CourseModule" DROP CONSTRAINT IF EXISTS "CourseModule_courseId_fkey";

-- DropTable
DROP TABLE IF EXISTS "CourseModule";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'guest';

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "links" JSONB,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hours" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_userId_key" ON "InstructorProfile"("userId");

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
