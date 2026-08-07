import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "relatore" | "corsista";
};

/**
 * Utente della richiesta corrente, o null se non autenticato.
 * Ogni route che tocca dati deve passare da qui: non esiste modalità ospite
 * (§2.3) e nessun endpoint deve fidarsi di un id utente inviato dal client.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
    role: session.user.role,
  };
}

/** Come `currentUser`, ma richiede anche il ruolo di relatore. */
export async function currentAdmin(): Promise<SessionUser | null> {
  const user = await currentUser();
  return user?.role === "relatore" ? user : null;
}
