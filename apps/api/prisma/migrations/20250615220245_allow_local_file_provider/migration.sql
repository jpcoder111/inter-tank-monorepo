/*
  Warnings:

  - You are about to drop the column `r2Key` on the `File` table. All the data in the column will be lost.
  - Added the required column `key` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileProvider" AS ENUM ('LOCAL', 'R2');

-- DropIndex
DROP INDEX "File_r2Key_key";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "r2Key",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "provider" "FileProvider" NOT NULL DEFAULT 'LOCAL';
