-- Add explicit source metadata to distinguish manual grants from course-share grants.
CREATE TYPE "LectureGrantSourceType" AS ENUM ('manual', 'course_share');

ALTER TABLE "LectureGrant"
ADD COLUMN "sourceType" "LectureGrantSourceType" NOT NULL DEFAULT 'manual',
ADD COLUMN "sourceRefId" TEXT;

CREATE INDEX "LectureGrant_sourceType_sourceRefId_idx"
ON "LectureGrant"("sourceType", "sourceRefId");

-- Backfill currently active auto grants inferred from accepted course shares.
UPDATE "LectureGrant" AS lg
SET
  "sourceType" = 'course_share'::"LectureGrantSourceType",
  "sourceRefId" = cs."id"
FROM "CourseLecture" AS cl
JOIN "CourseShare" AS cs
  ON cs."courseId" = cl."courseId"
WHERE lg."lectureId" = cl."lectureId"
  AND lg."userId" = cs."sharedWithUserId"
  AND lg."grantedByUserId" = cs."sharedByUserId"
  AND cs."status" = 'accepted'::"CourseShareStatus"
  AND lg."revokedAt" IS NULL
  AND lg."canMap" = TRUE
  AND lg."canEdit" = FALSE
  AND lg."canReshare" = FALSE
  AND lg."sourceType" = 'manual'::"LectureGrantSourceType";
