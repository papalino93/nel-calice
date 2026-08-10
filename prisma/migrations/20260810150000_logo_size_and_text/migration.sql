-- CreateEnum
CREATE TYPE "LogoSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- AlterTable
ALTER TABLE "CourseLogo" ADD COLUMN     "size" "LogoSize" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "text" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

-- Un riquadro dell'attestato è un'immagine caricata OPPURE un testo scritto
-- al suo posto. Mai entrambi, mai nessuno dei due: stesso schema di
-- "Material_exactly_one_owner" (20260807183500), stesso motivo — è il
-- database a doverlo impedire, non ogni punto del codice che ricorda di
-- controllare.
ALTER TABLE "CourseLogo"
  ADD CONSTRAINT "CourseLogo_exactly_one_content"
  CHECK (("url" IS NOT NULL) <> ("text" IS NOT NULL));
