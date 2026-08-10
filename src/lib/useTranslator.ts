"use client";

import { useState } from "react";
import { post, errorMessage } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Traduzione automatica IT→EN per i moduli del pannello relatore (titoli di
 * corso e lezione, domande, dispense): manda l'italiano a
 * `POST /api/admin/translate` e restituisce l'inglese, senza salvarlo da
 * sé — chi chiama decide dove metterlo, e il testo resta modificabile prima
 * di salvare (§ promessa bilingue).
 */
export function useTranslator() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function translate(texts: string[]): Promise<string[] | null> {
    setBusy(true);
    setError(null);
    const result = await post<{ translations: string[] }>(
      "/api/admin/translate",
      { texts },
    );
    setBusy(false);
    if (result.ok) return result.data.translations;
    setError(errorMessage(result, t));
    return null;
  }

  return { translate, busy, error };
}
