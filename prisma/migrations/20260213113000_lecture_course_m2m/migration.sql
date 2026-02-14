-- Create CourseLecture (join table)
CREATE TABLE "CourseLecture" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLecture_pkey" PRIMARY KEY ("id")
);

-- Create LectureGrant
CREATE TABLE "LectureGrant" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "canMap" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canReshare" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LectureGrant_pkey" PRIMARY KEY ("id")
);

-- Add new Lecture columns
ALTER TABLE "Lecture" ADD COLUMN "authorId" TEXT;
ALTER TABLE "Lecture" ADD COLUMN "originLectureId" TEXT;

-- Backfill authorId from createdBy
UPDATE "Lecture"
SET "authorId" = "createdBy"
WHERE "authorId" IS NULL;

-- Backfill CourseLecture from existing Lecture.courseId
INSERT INTO "CourseLecture" ("id", "courseId", "lectureId", "order", "createdBy", "createdAt")
SELECT
    CONCAT('cl_', EXTRACT(EPOCH FROM NOW())::BIGINT, '_', "Lecture"."id"),
    "Lecture"."courseId",
    "Lecture"."id",
    "Lecture"."order",
    "Lecture"."createdBy",
    "Lecture"."createdAt"
FROM "Lecture"
WHERE "Lecture"."courseId" IS NOT NULL;

-- Drop foreign key and column courseId
ALTER TABLE "Lecture" DROP CONSTRAINT IF EXISTS "Lecture_courseId_fkey";
ALTER TABLE "Lecture" DROP COLUMN "courseId";

-- Indexes and constraints
CREATE UNIQUE INDEX "CourseLecture_courseId_lectureId_key" ON "CourseLecture"("courseId", "lectureId");
CREATE INDEX "CourseLecture_courseId_idx" ON "CourseLecture"("courseId");
CREATE INDEX "CourseLecture_lectureId_idx" ON "CourseLecture"("lectureId");

CREATE UNIQUE INDEX "LectureGrant_lectureId_userId_key" ON "LectureGrant"("lectureId", "userId");
CREATE INDEX "LectureGrant_userId_idx" ON "LectureGrant"("userId");

-- Foreign keys
ALTER TABLE "CourseLecture" ADD CONSTRAINT "CourseLecture_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLecture" ADD CONSTRAINT "CourseLecture_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LectureGrant" ADD CONSTRAINT "LectureGrant_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LectureGrant" ADD CONSTRAINT "LectureGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
