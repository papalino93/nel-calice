import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "relatore" | "corsista";
};

/**
 * Utente della richiesta corrente, o null se non autenticato.
 *
 * Ogni route che tocca dati deve passare da qui: non esiste modalità ospite
 * (§2.3) e nessun endpoint deve fidarsi di un id utente inviato dal client.
 *
 * L'esistenza dell'utente viene verificata sul database ad ogni richiesta,
 * non data per scontata dal token. La sessione dura 60 giorni e vive nel
 * cookie: nel frattempo l'account può essere stato cancellato, e senza
 * questo controllo ogni chiamata fallirebbe con un errore incomprensibile
 * su una chiave esterna, invece di chiedere semplicemente di rientrare.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Il ruolo resta calcolato dall'allowlist, non letto dal database.
    role: session.user.role,
  };
}

/** Come `currentUser`, ma richiede anche il ruolo di relatore. */
export async function currentAdmin(): Promise<SessionUser | null> {
  const user = await currentUser();
  return user?.role === "relatore" ? user : null;
}
