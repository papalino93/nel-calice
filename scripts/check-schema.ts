import { prisma } from "../src/lib/prisma";

// Controlla che il database puntato dall'ambiente abbia davvero quello che il
// codice si aspetta. **Non scrive niente**: solo SELECT, quindi si può
// puntare alla produzione senza pensarci.
//
// È il complemento di `npm run test:db`, che invece crea e cancella righe di
// prova per verificare i vincoli — quello va su un database di sviluppo,
// questo va ovunque.
//
// Perché esiste: dopo aver lanciato una migrazione resta sempre la stessa
// domanda, ed è quella che stamattina ha richiesto tre giri per rispondere —
// *l'ho lanciata sul database giusto?* Qui la risposta arriva in un comando,
// e la prima riga stampata è l'indirizzo del database a cui si è connesso.
//
// Riusa il client condiviso apposta: da un ambiente senza TCP diretto verso
// Postgres, con PRISMA_NEON_HTTP=1 passa da sé al driver HTTP di Neon (vedi
// src/lib/prisma.ts) — un `new PrismaClient()` locale non lo saprebbe fare.

let failed = false;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  OK " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
}

/**
 * Le colonne che il codice legge e che una migrazione deve aver creato.
 * Chi aggiunge una migrazione aggiunga qui la riga corrispondente: è la
 * differenza fra "l'ho lanciata" e "so che è arrivata".
 */
const EXPECTED_COLUMNS: {
  table: string;
  column: string;
  nullable: boolean;
  since: string;
}[] = [
  {
    table: "Question",
    column: "explanationIt",
    nullable: true,
    since: "20260808080000_question_explanation",
  },
  {
    table: "Question",
    column: "explanationEn",
    nullable: true,
    since: "20260808080000_question_explanation",
  },
];

async function main() {
  // Dove siamo. Senza credenziali: l'host si ricava dall'URL, la password no.
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1];
  // Il cast a text serve solo quando si passa dal driver HTTP di Neon
  // (PRISMA_NEON_HTTP=1): quel driver non sa deserializzare il tipo
  // `name` di Postgres che current_database() restituirebbe altrimenti.
  // Innocuo sul motore nativo che usa la produzione.
  const [{ current_database: database }] = await prisma.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()::text`;

  console.log(`\nDatabase: ${database} @ ${host ?? "host sconosciuto"}`);
  console.log(
    "Confronta questo host con POSTGRES_URL_NON_POOLING della produzione su Vercel.",
  );

  console.log("\n— Migrazioni applicate —");
  const migrations = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at ASC`;

  for (const m of migrations) {
    const state = m.rolled_back_at
      ? "ANNULLATA"
      : m.finished_at
        ? m.finished_at.toISOString().slice(0, 16).replace("T", " ")
        : "MAI FINITA";
    console.log(`       ${m.migration_name} — ${state}`);
  }

  console.log("\n— Colonne che il codice si aspetta —");
  for (const expected of EXPECTED_COLUMNS) {
    const rows = await prisma.$queryRaw<
      { data_type: string; is_nullable: string }[]
    >`SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${expected.table}
          AND column_name = ${expected.column}`;

    const column = rows[0];
    const applied = migrations.some(
      (m) => m.migration_name === expected.since && m.finished_at && !m.rolled_back_at,
    );

    check(
      `${expected.table}.${expected.column}`,
      Boolean(column) && (column.is_nullable === "YES") === expected.nullable,
      column
        ? `${column.data_type}, ${column.is_nullable === "YES" ? "opzionale" : "obbligatoria"}${applied ? "" : " — ma la migrazione non risulta applicata"}`
        : `manca: lancia \`npx prisma migrate deploy\` (${expected.since})`,
    );
  }

  // Le colonne possono esistere nel database e non nel client generato, se
  // qualcuno ha migrato senza rifare `prisma generate`. Questa lettura passa
  // dal client, quindi prova che le due parti si parlano davvero.
  console.log("\n— Il client Prisma legge quelle colonne —");
  try {
    const sample = await prisma.question.findFirst({
      select: { id: true, explanationIt: true, explanationEn: true },
    });
    const withExplanation = await prisma.question.count({
      where: { OR: [{ explanationIt: { not: null } }, { explanationEn: { not: null } }] },
    });
    const total = await prisma.question.count();

    check(
      "la spiegazione si legge dal client generato",
      true,
      sample ? "letta una domanda di prova" : "nessuna domanda in catalogo",
    );
    console.log(
      `       ${withExplanation} domande su ${total} hanno una spiegazione scritta.`,
    );
    if (total > 0 && withExplanation === 0) {
      console.log(
        "       (Zero è normale finché nessuno ne ha scritta una: la revisione\n" +
          "        resta com'era prima, mostrando solo la risposta corretta.)",
      );
    }
  } catch (error) {
    check(
      "la spiegazione si legge dal client generato",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  console.log(
    failed
      ? "\nQualcosa non torna: vedi le righe FAIL qui sopra.\n"
      : "\nIl database ha tutto quello che il codice si aspetta.\n",
  );
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
