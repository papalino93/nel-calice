"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

/**
 * `localStorage` non è sempre raggiungibile: Safari con i cookie bloccati,
 * una webview con i dati del sito disattivati, o la modalità privata di
 * qualche browser fanno **lanciare** l'accesso, non restituire `null`.
 *
 * Questa lettura avviene durante il render, e questo provider avvolge tutta
 * l'applicazione: un'eccezione qui non spegneva la scelta della lingua, la
 * pagina diventava bianca — ogni pagina. Meglio l'italiano che niente.
 */
/**
 * Scelta valida solo per questa scheda, usata quando `localStorage` non si
 * può scrivere: senza di essa il commutatore IT/EN restava premibile e
 * inerte, perché la lettura tornava a cercare un valore che non era stato
 * possibile salvare.
 */
let sessionLanguage: Language | null = null;

function readLanguage(): Language {
  if (sessionLanguage !== null) return sessionLanguage;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "it";
  } catch {
    return "it";
  }
}

/** Sul server la lingua è sempre l'italiano, che è quella principale (§2.6). */
function serverLanguage(): Language {
  return "it";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLanguage, serverLanguage);

  // La pagina esce dal server dichiarata italiana. Chi aveva scelto l'inglese
  // se lo ritrova al ricaricamento, ma l'attributo restava "it": una pagina
  // inglese annunciata come italiana confonde i lettori di schermo e fa
  // scattare i traduttori automatici del browser.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non si può ricordare fra una visita e l'altra, ma almeno la lingua
      // cambia adesso: è meglio di un pulsante che non fa niente.
      sessionLanguage = next;
    }
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
      className={`inline-flex items-center rounded-full bg-cream/8 p-0.5 text-xs ${className}`}
      role="group"
      aria-label="Lingua / Language"
    >
      {(["it", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`press inline-flex min-h-10 items-center rounded-full px-4 font-medium uppercase tracking-wide transition-colors ${
            lang === code
              ? "bg-gold text-charcoal"
              : "text-cream/55 hover:text-cream/80"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
