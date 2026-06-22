-- AlterEnum
ALTER TYPE "TournamentStatus" ADD VALUE IF NOT EXISTS 'CHECK_IN';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOURNAMENT_CHECK_IN';

-- AlterTable
ALTER TABLE "TournamentEntry" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
