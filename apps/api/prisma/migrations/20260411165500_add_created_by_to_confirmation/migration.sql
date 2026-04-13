-- AlterTable
ALTER TABLE "Confirmation" ADD COLUMN "createdById" INTEGER;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TODO: Backfill existing rows with the correct user, then run:
-- ALTER TABLE "Confirmation" ALTER COLUMN "createdById" SET NOT NULL;
-- ALTER TABLE "Confirmation" DROP CONSTRAINT "Confirmation_createdById_fkey";
-- ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
