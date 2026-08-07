import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./session";
import { findEnrollment, type EnrollmentRef } from "./enrollment";

// Ogni route che tocca i dati di un corso passa da qui.
//
// Il punto non è risparmiare righe: è che l'iscrizione venga risolta sempre
// nello stesso modo, dalla sessione e dallo slug nell'indirizzo, e mai da un
// id mandato dal client. Un endpoint che si dimenticasse questo controllo
// aprirebbe i dati di un corso a chi non ci è iscritto.

export type Denied = { response: NextResponse };

export function isDenied<T>(result: T | Denied): result is Denied {
  return typeof result === "object" && result !== null && "response" in result;
}

export async function requireUser(): Promise<SessionUser | Denied> {
  const user = await currentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "non autenticato" }, { status: 401 }),
    };
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser | Denied> {
  const user = await currentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "non autenticato" }, { status: 401 }),
    };
  }
  if (user.role !== "relatore") {
    // 404 e non 403: a chi non è relatore l'area non risulta nemmeno esistere.
    return {
      response: NextResponse.json({ error: "non trovato" }, { status: 404 }),
    };
  }
  return user;
}

export type EnrolledContext = {
  user: SessionUser;
  enrollment: EnrollmentRef;
};

/** L'utente autenticato *e iscritto* al corso indicato dallo slug. */
export async function requireEnrollment(
  slug: string,
): Promise<EnrolledContext | Denied> {
  const user = await requireUser();
  if (isDenied(user)) return user;

  const enrollment = await findEnrollment(user.id, slug);
  if (!enrollment) {
    return {
      response: NextResponse.json(
        { error: "non iscritto", needsEnrollment: true },
        { status: 403 },
      ),
    };
  }

  return { user, enrollment };
}
