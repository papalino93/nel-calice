"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import { LockIcon } from "@/components/icons";

/**
 * Modale del codice della serata.
 *
 * Il campo di testo è un normale input controllato da React: non perde il
 * focus mentre si scrive. Nell'app attuale ogni cambio di stato ridisegnava
 * l'intera pagina con `innerHTML`, e per tenere il focus si scriveva a mano
 * nel DOM in tre punti diversi (difetto §7.8) — una toppa che si allargava
 * ad ogni campo nuovo.
 */
export function UnlockDialog({
  lessonId,
  lessonTitle,
  onClose,
  onUnlocked,
}: {
  lessonId: number;
  lessonTitle: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;

    setBusy(true);
    setError(null);

    const result = await post<{ unlocked: boolean }>(
      `/api/lessons/${lessonId}/unlock`,
      { code },
    );

    setBusy(false);

    if (result.ok) {
      onUnlocked();
      return;
    }
    // L'utente deve sapere cosa è andato storto, non restare a guardare.
    setError(result.offline ? t.networkError : result.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card rise-in w-full max-w-sm p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/12 text-gold">
            <LockIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="unlock-title" className="font-serif text-xl text-cream">
              {t.unlockTitle}
            </h2>
            <p className="truncate text-xs text-cream/45">{lessonTitle}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-cream/60">{t.unlockHint}</p>

        <form onSubmit={submit} className="mt-4">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              // L'errore del tentativo precedente sparisce appena si
              // ricomincia a scrivere: lasciarlo lì fa credere che il
              // nuovo codice sia già stato rifiutato.
              if (error) setError(null);
            }}
            placeholder={t.unlockPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-xl border border-gold/25 bg-charcoal/60 px-4 py-3 text-center font-serif text-xl tracking-[0.2em] text-cream uppercase placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-cream/30 focus:border-gold/60 focus:outline-none"
          />

          {error && (
            <p className="mt-3 text-center text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="press flex-1 rounded-full border border-cream/15 px-4 py-2.5 text-sm text-cream/70 transition-colors hover:text-cream"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!code.trim() || busy}
              className="press flex-1 rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-charcoal transition-opacity disabled:opacity-40"
            >
              {t.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
