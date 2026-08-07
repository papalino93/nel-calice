-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "enrollmentCodeLookup" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CourseLesson" ADD COLUMN     "unlockCodeLookup" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Course_enrollmentCodeLookup_key" ON "Course"("enrollmentCodeLookup");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_courseId_unlockCodeLookup_key" ON "CourseLesson"("courseId", "unlockCodeLookup");

