import { InstructorRole } from "@prisma/client";
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
  await prisma.instructorAccess.upsert({
    where: { email },
    create: { email, role },
    update: { role },
  });
  return NextResponse.json({ saved: true });
}

/** Rimuove un accesso creato dall'area; l'owner tecnico non è eliminabile qui. */
export async function DELETE(request: Request) {
  const admin = await requireOwner();
  if (isDenied(admin)) return admin.response;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!email || bootstrapOwnerEmails().includes(email)) return invalid();

  const target = await prisma.instructorAccess.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ removed: true });
  if (target.role === InstructorRole.OWNER) {
    const owners = await prisma.instructorAccess.count({ where: { role: InstructorRole.OWNER } });
    if (owners <= 1) {
      return NextResponse.json({ error: "Deve restare almeno un proprietario." }, { status: 409 });
    }
  }
  await prisma.instructorAccess.delete({ where: { email } });
  return NextResponse.json({ removed: true });
}
