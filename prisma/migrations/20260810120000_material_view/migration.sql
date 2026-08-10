-- CreateTable
CREATE TABLE "MaterialView" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialView_materialId_viewedAt_idx" ON "MaterialView"("materialId", "viewedAt");

-- CreateIndex
CREATE INDEX "MaterialView_enrollmentId_idx" ON "MaterialView"("enrollmentId");

-- AddForeignKey
ALTER TABLE "MaterialView" ADD CONSTRAINT "MaterialView_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialView" ADD CONSTRAINT "MaterialView_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
