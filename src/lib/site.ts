// L'indirizzo pubblico del sito, per le cose che vengono stampate.
//
// Serve in un punto solo, ma quel punto è l'attestato: un PNG che il corsista
// si porta via e magari appende. Il link di verifica scritto lì dentro deve
// restare valido anche letto da un foglio, quindi non può essere relativo.
//
// L'ordine è: quello che dice l'ambiente, poi quello che Vercel sa da sé,
// poi la produzione nota. L'ultimo scalino non è eleganza — è che un
// attestato senza indirizzo è un attestato non verificabile, e vale meglio
// un valore giusto per il 99% dei casi che un campo vuoto.

const FALLBACK = "nuovo-corso-vino.vercel.app";

/** Solo l'host, senza schema e senza barra finale: si legge sulla carta. */
export function siteHost(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return explicit.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
  // Impostata da Vercel su ogni deploy, e punta sempre alla produzione
  // (non all'anteprima): è esattamente ciò che va stampato.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return vercel.replace(/\/+$/, "");

  return FALLBACK;
}
