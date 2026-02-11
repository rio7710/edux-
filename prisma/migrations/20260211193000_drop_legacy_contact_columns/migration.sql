-- Remove legacy duplicated contact columns.
ALTER TABLE "Instructor"
DROP COLUMN "phone";

ALTER TABLE "InstructorProfile"
DROP COLUMN "phone",
DROP COLUMN "website";
