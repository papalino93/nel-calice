"use client";

import { signIn } from "next-auth/react";
import { GoogleG, Seal } from "@/components/icons";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";

export function Login() {
  const { t } = useLanguage();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="rise-in flex flex-col items-center text-center max-w-sm">
        <Seal size={112} />

        <h1 className="mt-8 font-serif text-4xl sm:text-5xl leading-tight text-cream">
          {t.courseTitle}
        </h1>
        <p className="mt-3 text-sm text-cream/55">{t.courseSubtitle}</p>

        <button
          type="button"
          onClick={() => signIn("google")}
          className="press lift mt-10 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 font-medium text-charcoal shadow-lg shadow-black/25 transition-transform"
        >
          <GoogleG className="h-5 w-5" />
          {t.signIn}
        </button>

        <p className="mt-5 text-xs leading-relaxed text-cream/40">
          {t.signInHint}
        </p>
      </div>
    </main>
  );
}
