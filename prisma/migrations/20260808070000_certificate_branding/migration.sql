-- AlterTable
ALTER TABLE "Course" ADD COLUMN "certificateIssuer" TEXT;

-- CreateTable
CREATE TABLE "CourseLogo" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLogo_courseId_idx" ON "CourseLogo"("courseId");

-- AddForeignKey
ALTER TABLE "CourseLogo" ADD CONSTRAINT "CourseLogo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
