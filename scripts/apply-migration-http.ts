import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

// Applica una migrazione già scritta e verificata (contro un Postgres
// sandbox, con `prisma migrate diff` a zero scostamento) quando `prisma
// migrate deploy` non può farlo da qui: il motore delle migrazioni usa
// sempre una connessione TCP diretta, e non passa dal driver HTTP di
// src/lib/prisma.ts (quello vale solo per le query di PrismaClient).
//
// Esegue l'SQL della migrazione e scrive la riga in _prisma_migrations
// esattamente come farebbe `migrate deploy` — stesso checksum (sha256 del
// file), stesso formato — così uno `prisma migrate status` lanciato da
// un ambiente con TCP diretto la vede applicata, non mancante.
//
// Uso: PRISMA_NEON_HTTP=1 tsx scripts/apply-migration-http.ts <cartella>
// (la cartella è il nome dentro prisma/migrations/, non un percorso).

async function main() {
  const dirName = process.argv[2];
  if (!dirName) {
    console.error("Uso: tsx scripts/apply-migration-http.ts <cartella-migrazione>");
    process.exit(1);
  }

  const sqlPath = join("prisma/migrations", dirName, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const already = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `select migration_name from "_prisma_migrations" where migration_name = $1`,
    dirName,
  );
  if (already.length > 0) {
    console.log(`${dirName} è già segnata come applicata: non la rilancio.`);
    await prisma.$disconnect();
    return;
  }

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const startedAt = new Date();
  await prisma.$transaction([
    ...statements.map((statement) => prisma.$executeRawUnsafe(statement + ";")),
    prisma.$executeRawUnsafe(
      `insert into "_prisma_migrations"
         (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       values ($1, $2, $3, $4, $5, $6)`,
      randomUUID(),
      checksum,
      dirName,
      startedAt,
      new Date(),
      statements.length,
    ),
  ]);

  console.log(
    `Applicata ${dirName}: ${statements.length} istruzioni, checksum ${checksum}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
