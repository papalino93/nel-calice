-- Una dispensa appartiene a UNA lezione del catalogo, OPPURE a un corso
-- (materiale "generale" di quell'edizione). Mai a entrambi, mai a nessuno
-- dei due.
--
-- Prisma non sa esprimere questa regola, quindi la si scrive direttamente
-- in SQL: così è il database a rifiutare una riga incoerente, invece di
-- affidarsi al fatto che ogni punto del codice si ricordi di controllare.
ALTER TABLE "Material"
  ADD CONSTRAINT "Material_exactly_one_owner"
  CHECK (("lessonId" IS NOT NULL) <> ("courseId" IS NOT NULL));
