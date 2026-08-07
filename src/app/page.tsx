"use client";

import { useSession } from "next-auth/react";
import { Dashboard } from "@/components/Dashboard";
import { Login } from "@/components/Login";
import { useLanguage } from "@/components/LanguageProvider";

export default function Home() {
  const { status } = useSession();
  const { t } = useLanguage();

  // Mentre si verifica la sessione non si mostra il pulsante di login, così
  // non lampeggia a chi è già collegato (§3.1).
  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  return status === "authenticated" ? <Dashboard /> : <Login />;
}
