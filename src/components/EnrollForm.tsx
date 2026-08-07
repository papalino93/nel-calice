"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Ingresso a un corso con il codice detto in aula.
 *
 * Il codice basta da solo: i codici d'iscrizione sono unici su tutti i corsi
 * (vincolo sul database), quindi identificano il corso senza che il corsista
 * debba conoscere un indirizzo. Chi arriva da un link `/corso/<slug>` vede
 * lo stesso campo, ma già puntato su quel corso.
 */
export function EnrollForm({
  courseSlug,
  onEnrolled,
}: {
  /** Se presente, l'iscrizione è ristretta a questo corso. */
  courseSlug?: string;
  onEnrolled: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;

    setBusy(true);
    setError(null);

    const url = courseSlug
      ? `/api/courses/${courseSlug}/enroll`
      : "/api/enroll";
    const result = await post<{ enrolled: boolean }>(url, { code });

    setBusy(false);

    if (result.ok) {
      onEnrolled();
      return;
    }
    setError(result.offline ? t.networkError : result.error);
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-6">
      <h2 className="font-serif text-2xl text-cream">{t.enrollTitle}</h2>
      <p className="mt-1.5 text-sm text-cream/55">{t.enrollHint}</p>

      <input
        ref={inputRef}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (error) setError(null);
        }}
        placeholder={t.enrollPlaceholder}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="mt-5 w-full rounded-xl border border-gold/25 bg-charcoal/60 px-4 py-3 text-center font-serif text-xl tracking-[0.2em] text-cream uppercase placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-cream/30 focus:border-gold/60 focus:outline-none"
      />

      {error && (
        <p className="mt-3 text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!code.trim() || busy}
        className="press mt-5 w-full rounded-full bg-gold px-4 py-3 font-medium text-charcoal transition-opacity disabled:opacity-40"
      >
        {t.enroll}
      </button>
    </form>
  );
}
