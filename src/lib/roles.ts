import { InstructorRole } from "@prisma/client";
import { prisma } from "./prisma";

// ADMIN_EMAILS resta la cintura di sicurezza del proprietario iniziale: non
// sparisce se una migrazione o un dato venisse toccato per errore. Gli altri
// relatori vivono invece nel database e vengono gestiti dall'app.
export function bootstrapOwnerEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type Role = "relatore" | "corsista";

export async function roleForEmail(
  email: string | null | undefined,
): Promise<Role> {
  if (!email) return "corsista";
  const normalized = normalizeEmail(email);
  if (bootstrapOwnerEmails().includes(normalized)) return "relatore";

  const access = await prisma.instructorAccess.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  return access ? "relatore" : "corsista";
}

export async function canManageInstructorAccess(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (bootstrapOwnerEmails().includes(normalized)) return true;
  const access = await prisma.instructorAccess.findUnique({
    where: { email: normalized },
    select: { role: true },
  });
  return access?.role === InstructorRole.OWNER;
}
