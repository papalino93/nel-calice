"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { ChevronDownIcon, Seal } from "@/components/icons";

/** Intestazione comune a tutte le pagine dell'area relatore. */
export function AdminShell({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  const { lang, t } = useLanguage();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-8 sm:px-8">
      <header className="mb-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="press text-sm text-cream/55 transition-colors hover:text-cream"
          >
            ← {backLabel}
          </Link>
          <LanguageToggle />
        </div>

        <div className="flex items-center gap-3">
          <Seal size={44} />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-gold/70">
              {t.adminArea}
            </p>
            <h1 className="line-clamp-2 font-serif text-2xl leading-tight text-cream sm:truncate sm:text-3xl">
              {title}
            </h1>
          </div>
        </div>

        {/* Orientamento costante: dopo giorni lontano dal sito il relatore
            non deve ricordare in quale pagina vivono corsi, contenuti e
            configurazione. */}
        <nav
          aria-label={t.adminArea}
          className="mt-5 flex flex-wrap gap-2 border-y border-gold/15 py-3 text-sm"
        >
          <Link href="/relatore" className="press rounded-full px-3 py-1.5 text-cream/70 hover:bg-cream/8 hover:text-cream">
            {t.adminArea}
          </Link>
          <Link href="/relatore/catalogo" className="press rounded-full px-3 py-1.5 text-cream/70 hover:bg-cream/8 hover:text-cream">
            {lang === "en" ? "Lesson catalogue" : "Catalogo lezioni"}
          </Link>
          <Link href="/relatore/impostazioni" className="press rounded-full px-3 py-1.5 text-cream/70 hover:bg-cream/8 hover:text-cream">
            {lang === "en" ? "Settings" : "Impostazioni"}
          </Link>
        </nav>
      </header>

      {children}
    </main>
  );
}

/**
 * Sezione richiudibile: intestazione in maiuscoletto oro, nota esplicativa,
 * e tutto il resto sotto — chiuso o aperto senza perdere lo stato di quello
 * che c'è dentro (`<details>` lascia il contenuto montato, non lo distrugge
 * alla chiusura). `defaultOpen` decide solo il primo caricamento della
 * pagina: da lì in poi è il relatore a scegliere cosa vedere, sezione per
 * sezione, invece di scorrere sempre tutto quanto insieme.
 *
 * `id` serve ai collegamenti rapidi in cima alla pagina del corso. Non basta
 * metterlo su un contenitore: un `<details>` chiuso non si apre da sé
 * quando lo si raggiunge con un'ancora, quindi «1. Iscrizioni» portava a una
 * sezione richiusa, senza niente da compilare sotto il titolo. Qui l'ancora
 * apre davvero la sezione a cui punta.
 */
export function AdminSection({
  id,
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!id) return;
    const openIfTargeted = () => {
      if (window.location.hash !== `#${id}`) return;
      const node = ref.current;
      if (!node) return;
      node.open = true;
      node.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, [id]);

  return (
    <details ref={ref} id={id} className="group mt-9 scroll-mt-4" open={defaultOpen}>
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <div className="press -mx-1 flex min-h-10 cursor-pointer items-start gap-2 rounded-lg px-1 py-2">
          <ChevronDownIcon className="mt-0.5 h-4 w-4 flex-none text-gold/60 transition-transform group-open:rotate-180" />
          <div className="min-w-0">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
              {title}
            </h2>
            {hint && (
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-cream/60">
                {hint}
              </p>
            )}
          </div>
        </div>
      </summary>
      <div className="ml-6 mt-3">{children}</div>
    </details>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-cream/55">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-gold/25 bg-charcoal/60 px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/25 focus:border-gold/60 focus:outline-none";

export const buttonClass =
  "press rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-charcoal transition-opacity disabled:opacity-40";

export const ghostButtonClass =
  "press rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/70 transition-colors hover:text-cream";
