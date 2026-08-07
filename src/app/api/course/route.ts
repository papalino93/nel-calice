import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { courseOverview } from "@/lib/course";

/**
 * Elenco lezioni con lo stato dell'utente corrente.
 * Notare cosa NON c'è nella risposta: i codici di sblocco e le domande.
 * Lo stato "bloccata" arriva già deciso dal server (difetto §7.2 e §7.9).
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const overview = await courseOverview(user.id);
  return NextResponse.json({
    ...overview,
    user: { name: user.name, email: user.email, role: user.role },
  });
}
