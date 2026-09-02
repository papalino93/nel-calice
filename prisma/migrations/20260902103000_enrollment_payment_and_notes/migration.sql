-- Gestione amministrativa della classe: il pagamento è esterno alla
-- piattaforma, dunque parte sempre "da verificare" e viene aggiornato dal
-- relatore; la nota è rigorosamente interna.
CREATE TYPE "PaymentStatus" AS ENUM ('TO_VERIFY', 'PAID');

ALTER TABLE "Enrollment"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'TO_VERIFY',
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "adminNotes" TEXT;
