/*
  Warnings:

  - You are about to drop the `CourseModule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourseModule" DROP CONSTRAINT "CourseModule_courseId_fkey";

-- DropTable
DROP TABLE "CourseModule";

-- CreateEnum (safely handle Role enum expansion)
-- First, rename old Role enum
ALTER TYPE "public"."Role" RENAME TO "_Role_old";

-- Create new Role enum with all values
CREATE TYPE "public"."Role" AS ENUM ('admin', 'operator', 'editor', 'instructor', 'viewer', 'guest');

-- Update User table: convert old role values to new enum type  
ALTER TABLE "User" 
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "public"."Role" USING "role"::text::"public"."Role",
  ALTER COLUMN "role" SET DEFAULT 'guest'::text::"public"."Role";

-- Drop old enum
DROP TYPE "_Role_old";

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
