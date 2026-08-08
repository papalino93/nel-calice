import Anthropic from "@anthropic-ai/sdk";

// Traduzione italiano → inglese dei testi del catalogo.
//
// Perché esiste: il commutatore IT/EN c'è su ogni pagina, ma i campi inglesi
// vanno riempiti a mano — e chi scrive il corso non scrive in inglese. Finché
// restano vuoti la promessa bilingue è disattesa, e il server ripiega
// sull'italiano.
//
// La traduzione **non** avviene al salvataggio: è un pulsante che riempie i
// campi, e quello che scrive resta modificabile. Un testo che va davanti ai
// corsisti deve poter passare da un occhio umano prima di essere salvato —
// e chi non sa l'inglese può comunque farlo rileggere a qualcun altro.

/** Il modello non è una scelta di configurazione: è testato con questo. */
const MODEL = "claude-opus-5";

/**
 * Quante stringhe si accettano in una volta. Una domanda con otto opzioni e
 * la spiegazione ne fa dieci; il limite è largo, serve solo a impedire che
 * una richiesta malformata mandi mezzo catalogo al modello.
 */
export const MAX_ITEMS = 40;

/** Limite per stringa, stessa ragione. */
export const MAX_CHARS = 2000;

const SYSTEM = `Traduci dall'italiano all'inglese i testi di un corso di
avvicinamento alla degustazione del vino.

Regole:
- Usa la terminologia enologica inglese corrente (AIS/WSET): "tannin",
  "bouquet", "structure", "finish", "varietal". Non tradurre alla lettera
  quando esiste il termine di mestiere.
- Lascia invariati i nomi propri: vitigni, denominazioni, regioni, cantine
  (Sangiovese, Barolo, Chianti Classico, Valpolicella).
- Conserva il registro: una domanda resta una domanda, un'opzione di risposta
  resta breve come l'originale. Non aggiungere spiegazioni, non allungare.
- Non aggiungere virgolette, numerazione o commenti attorno al testo.

Restituisci esattamente un elemento per ogni elemento ricevuto, nello stesso
ordine.`;

const SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: { type: "string" },
      description: "Le traduzioni, una per testo ricevuto, nello stesso ordine.",
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

export type TranslateResult =
  | { ok: true; translations: string[] }
  /// Manca ANTHROPIC_API_KEY: ambiente incompleto, non un guasto.
  | { ok: false; reason: "not-configured" }
  /// Il modello ha rifiutato. Su testi di enologia non dovrebbe succedere,
  /// ma se succede va detto invece di mostrare "errore".
  | { ok: false; reason: "refused" }
  | { ok: false; reason: "failed" };

/**
 * Traduce una lista di testi, mantenendo posizione e lunghezza.
 *
 * Le stringhe vuote non partono nemmeno: tornano vuote com'erano. Serve a non
 * far tradurre i campi facoltativi lasciati in bianco (una spiegazione che
 * non c'è, l'opzione appena aggiunta), e a non pagarli.
 */
export async function translateToEnglish(
  texts: string[],
): Promise<TranslateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "not-configured" };
  }

  // Indici dei testi che hanno davvero qualcosa da tradurre. Si traduce solo
  // quelli, e poi si rimettono al loro posto: il chiamante riceve una lista
  // lunga quanto quella che ha mandato, e non deve riallineare niente.
  const filled = texts
    .map((text, i) => ({ text: text.trim(), i }))
    .filter((entry) => entry.text.length > 0);

  if (filled.length === 0) return { ok: true, translations: texts.map(() => "") };

  const client = new Anthropic();

  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      // `low`: tradurre otto righe di enologia non è un problema di
      // ragionamento. Il pensiero resta acceso (è il modo consigliato su
      // questo modello); l'effort basso è ciò che tiene bassi costo e attesa,
      // e il relatore sta guardando il modulo mentre aspetta.
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: JSON.stringify(filled.map((entry) => entry.text)),
        },
      ],
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  // Va guardato **prima** del contenuto: su un rifiuto `content` è vuoto, e
  // leggerlo comunque darebbe un errore generico invece della vera causa.
  if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };

  const text = message.content.find((block) => block.type === "text")?.text;
  if (!text) return { ok: false, reason: "failed" };

  let parsed: { translations?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "failed" };
  }

  const translations = parsed.translations;
  // Lo schema garantisce la forma, non il conteggio: se tornassero più o meno
  // elementi di quanti ne sono partiti, riallinearli a indovinare scriverebbe
  // la traduzione di una domanda dentro il campo di un'altra. Meglio niente.
  if (
    !Array.isArray(translations) ||
    translations.length !== filled.length ||
    !translations.every((t) => typeof t === "string")
  ) {
    return { ok: false, reason: "failed" };
  }

  const out = texts.map(() => "");
  filled.forEach((entry, k) => {
    out[entry.i] = (translations[k] as string).trim();
  });
  return { ok: true, translations: out };
}
