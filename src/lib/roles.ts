// Il ruolo "relatore" non è mai un campo salvato su User: sarebbe
// falsificabile (o modificabile per errore) e andrebbe protetto con la
// stessa cura di un account admin. Invece è calcolato ad ogni richiesta
// confrontando l'email dell'account Google con un allowlist server-side.
//
// Per aggiungere un socio/relatore: aggiungere la sua email a ADMIN_EMAILS
// su Vercel (comma-separated), nessun codice da toccare.
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export type Role = "relatore" | "corsista";

export function roleForEmail(email: string | null | undefined): Role {
  return isAdminEmail(email) ? "relatore" : "corsista";
}
