import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import {
  MAX_CHARS,
  MAX_ITEMS,
  translateToEnglish,
} from "@/lib/translate";

/**
 * Traduce in inglese i testi che il relatore sta scrivendo.
 *
 * Non salva niente: risponde e basta. Quello che torna finisce nei campi del
 * modulo, dove resta modificabile, e viene scritto sul database solo se il
 * relatore preme Salva — come qualunque altra cosa abbia digitato a mano.
 *
 * È riservata al relatore, non perché i testi siano segreti (finiscono in
 * pagina), ma perché chiama un servizio a pagamento: aperta a chiunque
 * sarebbe una fattura scritta da estranei.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    texts?: unknown;
  } | null;

  const texts = body?.texts;
  if (!Array.isArray(texts) || !texts.every((t) => typeof t === "string")) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  if (texts.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Troppi testi in una volta (massimo ${MAX_ITEMS}).` },
      { status: 400 },
    );
  }

  if (texts.some((t) => t.length > MAX_CHARS)) {
    return NextResponse.json(
      { error: `Un testo supera i ${MAX_CHARS} caratteri.` },
      { status: 400 },
    );
  }

  const result = await translateToEnglish(texts as string[]);

  if (!result.ok) {
    // Le tre cause si distinguono, perché suggeriscono rimedi diversi: una
    // chiave mancante la mette il proprietario del progetto, un rifiuto si
    // aggira riscrivendo il testo, un guasto si riprova.
    if (result.reason === "not-configured") {
      return NextResponse.json(
        {
          error:
            "La traduzione automatica non è configurata: manca ANTHROPIC_API_KEY.",
        },
        { status: 503 },
      );
    }
    if (result.reason === "refused") {
      return NextResponse.json(
        { error: "La traduzione è stata rifiutata per questo testo." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Traduzione non riuscita. Riprova." },
      { status: 502 },
    );
  }

  return NextResponse.json({ translations: result.translations });
}
