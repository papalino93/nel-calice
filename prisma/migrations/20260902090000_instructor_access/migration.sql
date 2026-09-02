-- Accessi gestibili all'Area Relatore. Gli owner dichiarati in ADMIN_EMAILS
-- restano una protezione di emergenza lato ambiente; questa tabella rende
-- invece gestibili dall'interfaccia gli altri relatori.
CREATE TYPE "InstructorRole" AS ENUM ('OWNER', 'RELATORE');

CREATE TABLE "InstructorAccess" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "InstructorRole" NOT NULL DEFAULT 'RELATORE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstructorAccess_email_key" ON "InstructorAccess"("email");
