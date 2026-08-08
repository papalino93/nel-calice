"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { strings, type Language, type Strings } from "@/lib/i18n";

type LanguageContextValue = {
  lang: Language;
  t: Strings;
  setLang: (lang: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "corso-vino-lingua";

// La scelta della lingua vive in localStorage, che è una sorgente esterna a
// React: `useSyncExternalStore` è il modo previsto per leggerla senza
// innescare un secondo render dopo il primo.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLanguage(): Language {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "it";
}

/** Sul server la lingua è sempre l'italiano, che è quella principale (§2.6). */
function serverLanguage(): Language {
  return "it";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLanguage, serverLanguage);

  const setLang = useCallback((next: Language) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    listeners.forEach((notify) => notify());
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t: strings[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage va usato dentro LanguageProvider");
  return ctx;
}

/** Interruttore IT/EN, sempre visibile in alto a destra (§3.9). */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-gold/25 p-0.5 text-xs ${className}`}
      role="group"
      aria-label="Lingua / Language"
    >
      {(["it", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`press inline-flex min-h-10 items-center rounded-full px-3.5 uppercase tracking-wide transition-colors ${
            lang === code
              ? "bg-gold/20 text-gold"
              : "text-cream/50 hover:text-cream/80"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
