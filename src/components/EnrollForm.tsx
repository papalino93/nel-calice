"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, post } from "@/lib/api";
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
  autoFocus = true,
}: {
  /** Se presente, l'iscrizione è ristretta a questo corso. */
  courseSlug?: string;
  onEnrolled: () => void;
  /** Da spegnere quando il modulo nasce dentro una sezione richiusa: il
      fuoco automatico lì apriva la tastiera del telefono su un campo che
      non si stava nemmeno guardando. */
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;

    setBusy(true);
    setError(null);
    setDone(null);

    const url = courseSlug
      ? `/api/courses/${courseSlug}/enroll`
      : "/api/enroll";
    const result = await post<{ enrolled: boolean; alreadyEnrolled?: boolean }>(
      url,
      { code },
    );

    setBusy(false);

    if (result.ok) {
      // Il campo va svuotato e l'esito detto: prima restava il codice
      // scritto e il pulsante tornava attivo senza che nulla cambiasse a
      // schermo finché non arrivava il ricaricamento — su rete lenta si
      // toccava «Iscriviti» una seconda volta, mandando due richieste.
      setCode("");
      setDone(result.data.alreadyEnrolled ? t.alreadyEnrolled : t.enrolled);
      onEnrolled();
      return;
    }
    setError(errorMessage(result, t));
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
          if (done) setDone(null);
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

      {done && (
        <p className="mt-3 text-center text-sm text-emerald-300" role="status">
          {done}
        </p>
      )}

      <button
        type="submit"
        disabled={!code.trim() || busy}
        className="press mt-5 min-h-11 w-full rounded-full bg-gold px-4 py-3 font-medium text-charcoal transition-opacity disabled:opacity-40"
      >
        {busy ? t.checkingSession : t.enroll}
      </button>
    </form>
  );
}
