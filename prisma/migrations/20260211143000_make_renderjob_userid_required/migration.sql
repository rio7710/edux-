-- Ensure there is no legacy nullable row before enforcing NOT NULL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RenderJob" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot set RenderJob.userId NOT NULL: found legacy rows with NULL userId';
  END IF;
END $$;

ALTER TABLE "RenderJob"
ALTER COLUMN "userId" SET NOT NULL;
