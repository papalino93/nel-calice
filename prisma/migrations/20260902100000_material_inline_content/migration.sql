-- Materiali salvati direttamente nel database (store Blob sospeso per
-- limite del piano Hobby, §STATO.md): url vale "db:inline" quando il file
-- vero sta in questa colonna invece che su Blob.
ALTER TABLE "Material" ADD COLUMN "content" BYTEA;
ALTER TABLE "Material" ADD COLUMN "contentType" TEXT;
