"use client";

import { usePathname } from "next/navigation";
import { GlassIcon } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * "Offrimi un calice" (§3.9).
 *
 * Regola: pillola piena con testo nella schermata d'ingresso, dove c'è spazio
 * e non disturba; ridotto alla sola icona in tutte le altre pagine, dove
 * ruberebbe attenzione al corso. Su desktop si riapre al passaggio del mouse;
 * su touch resta com'è, perché lì l'hover non esiste davvero.
 */
export function DonationButton({ href }: { href: string }) {
  const { lang } = useLanguage();
  const pathname = usePathname();

  const label = lang === "en" ? "Buy me a glass" : "Offrimi un calice";
  const expanded = pathname === "/";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`no-print press group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gold font-medium text-charcoal shadow-lg shadow-black/35 transition-all ${
        expanded ? "px-5 py-3" : "p-3.5"
      }`}
    >
      <GlassIcon className="h-5 w-5 shrink-0" />
      <span
        className={
          expanded
            ? "whitespace-nowrap"
            : // Chiuso di default; su desktop l'hover lo riapre.
              "hidden max-w-0 overflow-hidden whitespace-nowrap transition-all [@media(hover:hover)]:inline [@media(hover:hover)]:group-hover:max-w-40 [@media(hover:hover)]:group-hover:pl-0.5"
        }
      >
        {label}
      </span>
    </a>
  );
}
