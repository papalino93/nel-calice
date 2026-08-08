"use client";

import { signIn } from "next-auth/react";
import { GoogleG, Seal } from "@/components/icons";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";

export function Login() {
  const { lang, t } = useLanguage();

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
          onClick={() => signIn("google")}
          className="press lift mt-10 inline-flex items-center gap-3 rounded-full bg-white px-8 py-3.5 font-medium text-charcoal shadow-lg shadow-black/30 transition-transform"
        >
          <GoogleG className="h-5 w-5" />
          <span className="underline underline-offset-4">{t.signIn}</span>
        </button>

        <p className="mt-5 max-w-xs text-xs leading-relaxed text-cream/40">
          {t.signInHint}
        </p>
      </div>
    </main>
  );
}
