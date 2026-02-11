-- Add personal contact fields to User for profile-level ownership.
ALTER TABLE "User"
ADD COLUMN "phone" TEXT,
ADD COLUMN "website" TEXT;
