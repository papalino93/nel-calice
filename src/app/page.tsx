"use client";

import { signIn, signOut, useSession } from "next-auth/react";

// Verifica funzionale del flusso di login — non è ancora la UI definitiva
// (design system, sigillo, dashboard a due colonne: vedi RICOSTRUZIONE-PROMPT.md §3.1-3.2).
export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p>Verifica sessione…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Corso di Avvicinamento al Vino</h1>
        <button
          onClick={() => signIn("google")}
          className="rounded-full bg-white text-black px-6 py-3 font-medium border"
        >
          Accedi con Google
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3">
      <p>
        Collegato come <strong>{session.user.email}</strong>
      </p>
      <p>
        Ruolo: <strong>{session.user.role}</strong>
      </p>
      <button onClick={() => signOut()} className="underline text-sm">
        Esci dall&apos;account
      </button>
    </main>
  );
}
