-- AlterTable
ALTER TABLE "EnrollmentAttempt" ALTER COLUMN "courseId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "EnrollmentAttempt_userId_createdAt_idx" ON "EnrollmentAttempt"("userId", "createdAt");

