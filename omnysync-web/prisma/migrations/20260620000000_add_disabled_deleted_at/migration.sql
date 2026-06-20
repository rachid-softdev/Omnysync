-- Add disabledAt and deletedAt fields to User model for session revocation
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
