"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { GoogleG, Seal } from "@/components/icons";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";

export function Login() {
  const { lang, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // `signIn` è una richiesta di rete, e la sua promessa non era gestita:
  // offline, o con il popup bloccato, il pulsante non faceva assolutamente
  // nulla — per sempre, senza dire perché.
  async function enter() {
    setBusy(true);
    setFailed(false);
    try {
      await signIn("google");
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="rise-in flex max-w-lg flex-col items-center text-center">
        <Seal size={116} />

        <h1 className="mt-7 font-serif text-4xl leading-[1.1] text-cream sm:text-5xl">
          {t.courseTitle}
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/55">
          {lang === "en"
            ? "A journey lesson by lesson, to discover wine one glass at a time."
            : "Un percorso lezione dopo lezione per scoprire i segreti del vino, calice dopo calice."}
        </p>

        <button
          type="button"
          onClick={() => void enter()}
          disabled={busy}
          className="press lift mt-10 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-8 py-3.5 font-medium text-charcoal shadow-lg shadow-black/30 transition-transform disabled:opacity-60"
        >
          <GoogleG className="h-5 w-5" />
          <span className="underline underline-offset-4">
            {busy ? t.checkingSession : t.signIn}
          </span>
        </button>

        {failed && (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {t.networkError}
          </p>
        )}

        <p className="mt-5 max-w-xs text-xs leading-relaxed text-cream/60">
          {t.signInHint}
        </p>

        <Link
          href="/prossimi-corsi"
          className="press mt-6 inline-flex min-h-11 items-center text-sm text-gold/85 underline underline-offset-4 hover:text-gold"
        >
          {lang === "en" ? "Discover upcoming courses" : "Scopri i prossimi corsi"}
        </Link>
      </div>
    </main>
  );
}
