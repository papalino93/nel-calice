/*
  Warnings:

  - You are about to drop the column `unlockCodeHash` on the `Lesson` table. All the data in the column will be lost.
  - Added the required column `unlockCodeEncrypted` to the `Lesson` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Lesson_unlockCodeHash_key";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "unlockCodeHash",
ADD COLUMN     "unlockCodeEncrypted" TEXT NOT NULL;
