/**
 * Firma visibile sulle dispense: ogni copia porta addosso il nome di chi
 * l'ha aperta.
 *
 * Nasce da una richiesta impossibile — «impedire gli screenshot» — e dalla
 * sola risposta onesta che esiste. Sul web non si può bloccare né la cattura
 * dello schermo né la fotografia con un telefono: nessun browser lo permette,
 * e ogni trucco (tasto destro disabilitato, testo dentro un canvas) si aggira
 * in trenta secondi. Quello che si può fare è togliere l'anonimato: una
 * dispensa che gira porta scritto da chi è passata, e questo scoraggia molto
 * più di un divieto tecnico aggirabile.
 *
 * La firma è diagonale e ripetuta perché ritagliarla via non deve essere
 * comodo, ma chiara e non invadente perché la dispensa deve restare leggibile
 * a chi ne ha diritto: è un deterrente, non una punizione.
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Oltre questa dimensione non si timbra.
 *
 * Timbrare significa tenere in memoria il documento intero, e una funzione
 * serverless ha un tetto: su un file molto grande si rischierebbe di negare
 * la dispensa a chi ne ha diritto per difendersi da chi la girerebbe. Fra i
 * due errori si sceglie quello che non danneggia l'onesto.
 */
const MAX_BYTES = 12 * 1024 * 1024;

export type Reader = {
  name: string | null;
  email: string;
};

/** La riga che comparirà sul documento. */
export function readerLabel(reader: Reader, when: Date): string {
  const stamp = when.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const who = reader.name?.trim() ? `${reader.name.trim()} · ` : "";
  return `${who}${reader.email} · ${stamp}`;
}

/**
 * Restituisce il PDF timbrato, oppure `null` se non è il caso di timbrarlo
 * (troppo grande, o illeggibile da pdf-lib). Il chiamante serve l'originale:
 * meglio una dispensa senza firma che un corsista senza dispensa.
 */
export async function stampPdf(
  bytes: Uint8Array,
  label: string,
): Promise<Uint8Array | null> {
  if (bytes.byteLength > MAX_BYTES) return null;

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const size = 11;
    const width = font.widthOfTextAtSize(label, size);

    for (const page of pdf.getPages()) {
      const { width: w, height: h } = page.getSize();

      // Passo calcolato sulla lunghezza della scritta: righe fitte quanto
      // basta perché ritagliarne una non basti a togliere le altre.
      const step = Math.max(width * 0.8, 160);

      for (let y = -h; y < h * 2; y += step) {
        for (let x = -width; x < w + width; x += step * 1.6) {
          page.drawText(label, {
            x,
            y,
            size,
            font,
            color: rgb(0.45, 0.18, 0.22), // bordeaux, il colore di marca
            opacity: 0.13,
            rotate: degrees(35),
          });
        }
      }

      // Riga in chiaro in fondo: quella che si legge senza sforzo, e che
      // rende esplicito al lettore stesso di essere riconoscibile.
      page.drawText(label, {
        x: 24,
        y: 16,
        size: 7.5,
        font,
        color: rgb(0.35, 0.35, 0.35),
        opacity: 0.75,
      });
    }

    return await pdf.save();
  } catch {
    // Un PDF cifrato o malformato non deve impedire la lettura.
    return null;
  }
}
