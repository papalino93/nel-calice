import { InstructorRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import {
  bootstrapOwnerEmails,
  canManageInstructorAccess,
  normalizeEmail,
} from "@/lib/roles";

function invalid() {
  return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
}

const LAST_OWNER_ERROR = "Deve restare almeno un proprietario.";

class LastOwnerError extends Error {}

/** Proprietari totali: quelli da configurazione (sempre presenti) più quelli
 * gestiti dall'area relatore. È il conteggio giusto da proteggere — non solo
 * la tabella, altrimenti un proprietario da configurazione non basterebbe a
 * far passare per errore l'operazione che azzera quelli gestiti qui. */
async function totalOwnerCount(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const dbOwners = await tx.instructorAccess.count({
    where: { role: InstructorRole.OWNER },
  });
  return bootstrapOwnerEmails().length + dbOwners;
}

async function requireOwner() {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;
  if (!(await canManageInstructorAccess(admin.email))) {
    return { response: NextResponse.json({ error: "Solo un proprietario può gestire gli accessi." }, { status: 403 }) };
  }
  return admin;
}

/** Elenco leggibile di chi può entrare nell'Area Relatore. */
export async function GET() {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const [stored, isOwner] = await Promise.all([
    prisma.instructorAccess.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] }),
    canManageInstructorAccess(admin.email),
  ]);
  const bootstrap = new Set(bootstrapOwnerEmails());
  const members = [
    ...bootstrapOwnerEmails().map((email) => ({
      email,
      role: "OWNER" as const,
      source: "configurazione" as const,
      removable: false,
    })),
    ...stored
      .filter((person) => !bootstrap.has(person.email))
      .map((person) => ({
        email: person.email,
        role: person.role,
        source: "area-relatore" as const,
        removable: true,
      })),
  ];

  return NextResponse.json({
    currentEmail: admin.email,
    canManage: isOwner,
    members,
  });
}

/** Aggiunge o aggiorna una persona autorizzata. */
export async function POST(request: Request) {
  const admin = await requireOwner();
  if (isDenied(admin)) return admin.response;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const role = body?.role === "OWNER" ? InstructorRole.OWNER : body?.role === "RELATORE" ? InstructorRole.RELATORE : null;
  if (!email || !email.includes("@") || !role) return invalid();

  if (bootstrapOwnerEmails().includes(email)) {
    return NextResponse.json({ saved: true });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Stessa regola del DELETE, qui applicata anche a chi *cambia* ruolo:
        // declassare l'ultimo proprietario a Relatore lo lascerebbe fuori
        // dalla gestione degli accessi senza nessun avviso.
        if (role !== InstructorRole.OWNER) {
          const existing = await tx.instructorAccess.findUnique({ where: { email } });
          if (existing?.role === InstructorRole.OWNER) {
            if ((await totalOwnerCount(tx)) <= 1) throw new LastOwnerError();
          }
        }
        await tx.instructorAccess.upsert({
          where: { email },
          create: { email, role },
          update: { role },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof LastOwnerError) {
      return NextResponse.json({ error: LAST_OWNER_ERROR }, { status: 409 });
    }
    // Conflitto di scrittura seriale: due richieste hanno toccato gli stessi
    // proprietari nello stesso istante. Non è un errore dell'utente — basta
    // riprovare — ma non lo confermiamo come riuscito.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Qualcun altro ha modificato gli accessi nello stesso momento. Riprova." },
        { status: 409 },
      );
    }
    throw error;
  }
  return NextResponse.json({ saved: true });
}

/** Rimuove un accesso creato dall'area; l'owner tecnico non è eliminabile qui. */
export async function DELETE(request: Request) {
  const admin = await requireOwner();
  if (isDenied(admin)) return admin.response;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!email || bootstrapOwnerEmails().includes(email)) return invalid();

  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.instructorAccess.findUnique({ where: { email } });
        if (!target) return;
        if (target.role === InstructorRole.OWNER) {
          if ((await totalOwnerCount(tx)) <= 1) throw new LastOwnerError();
        }
        await tx.instructorAccess.delete({ where: { email } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof LastOwnerError) {
      return NextResponse.json({ error: LAST_OWNER_ERROR }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Qualcun altro ha modificato gli accessi nello stesso momento. Riprova." },
        { status: 409 },
      );
    }
    throw error;
  }
  return NextResponse.json({ removed: true });
}
