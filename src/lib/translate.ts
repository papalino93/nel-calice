// Traduzione italiano → inglese dei testi del catalogo, tramite MyMemory
// (api.mymemory.translated.net): gratuita, senza chiave né registrazione né
// carta — scelta deliberata (§7.20) per non far dipendere una comodità di
// scrittura da un servizio a pagamento. Prima usava Anthropic: costava
// pochi centesimi al mese per questo utilizzo, ma "mai un euro" è stato il
// vincolo esplicito del committente, non negoziabile in cambio di qualità.
//
// Perché esiste comunque: il commutatore IT/EN c'è su ogni pagina, ma i
// campi inglesi vanno riempiti a mano — e chi scrive il corso non scrive in
// inglese. Finché restano vuoti la promessa bilingue è disattesa, e il
// server ripiega sull'italiano.
//
// La traduzione **non** avviene al salvataggio: è un pulsante che riempie i
// campi, e quello che scrive resta modificabile. Un testo che va davanti ai
// corsisti deve poter passare da un occhio umano prima di essere salvato —
// tanto più con un servizio gratuito, di qualità più grezza di un modello
// che capisce il contesto enologico.
//
// Limite del piano anonimo: circa 5000 parole al giorno, per indirizzo IP —
// ampio per un pannello con un solo relatore, ma non infinito. Quando si
// esaurisce, MyMemory risponde comunque 200 con un testo di avviso al posto
// della traduzione: va riconosciuto per quello che è, non mostrato come se
// fosse la traduzione vera.

const ENDPOINT = "https://api.mymemory.translated.net/get";
const LANGPAIR = "it|en";

/**
 * Quante stringhe si accettano in una volta. Una domanda con otto opzioni e
 * la spiegazione ne fa dieci; il limite è largo, serve solo a impedire che
 * una richiesta malformata ne mandi centinaia in un colpo.
 */
export const MAX_ITEMS = 40;

/**
 * Limite per stringa. Più basso di quando c'era Anthropic (2000): l'API
 * gratuita di MyMemory è pensata per frasi brevi — titoli, domande, opzioni,
 * una spiegazione — non per paragrafi lunghi, e oltre questa soglia la
 * qualità peggiora sensibilmente.
 */
export const MAX_CHARS = 500;

export type TranslateResult =
  | { ok: true; translations: string[] }
  /// Soglia giornaliera gratuita esaurita: si riprova più tardi, non è un
  /// guasto e non c'è una chiave da configurare per aggiustarlo.
  | { ok: false; reason: "quota" }
  | { ok: false; reason: "failed" };

type OneResult = { ok: true; text: string } | { ok: false; quota: boolean };

async function translateOne(text: string): Promise<OneResult> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${LANGPAIR}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, quota: false };

    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
      quotaFinished?: boolean;
    };
    const translated = data.responseData?.translatedText;
    if (typeof translated !== "string") return { ok: false, quota: false };

    // Il servizio esaurito risponde 200 con questo avviso al posto del
    // testo tradotto: senza riconoscerlo, finirebbe scritto come se fosse
    // la traduzione vera.
    if (data.quotaFinished || translated.startsWith("MYMEMORY WARNING")) {
      return { ok: false, quota: true };
    }
    return { ok: true, text: translated };
  } catch {
    return { ok: false, quota: false };
  }
}

/**
 * Traduce una lista di testi, mantenendo posizione e lunghezza.
 *
 * Le stringhe vuote non partono nemmeno: tornano vuote com'erano. Serve a
 * non far tradurre i campi facoltativi lasciati in bianco (una spiegazione
 * che non c'è, l'opzione appena aggiunta).
 *
 * MyMemory non accetta più testi in una sola chiamata come faceva Anthropic
 * con lo schema condiviso: qui si chiama una volta per testo, in parallelo.
 */
export async function translateToEnglish(
  texts: string[],
): Promise<TranslateResult> {
  const filled = texts
    .map((text, i) => ({ text: text.trim(), i }))
    .filter((entry) => entry.text.length > 0);

  if (filled.length === 0) return { ok: true, translations: texts.map(() => "") };

  const results = await Promise.all(
    filled.map((entry) => translateOne(entry.text)),
  );

  if (results.some((r) => !r.ok && r.quota)) return { ok: false, reason: "quota" };
  if (results.some((r) => !r.ok)) return { ok: false, reason: "failed" };

  const out = texts.map(() => "");
  filled.forEach((entry, k) => {
    const r = results[k];
    if (r.ok) out[entry.i] = r.text.trim();
  });
  return { ok: true, translations: out };
}
