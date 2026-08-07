import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// I codici di sblocco sono cifrati, non hashati.
//
// La differenza è voluta e nasce da un vincolo pratico: il relatore deve
// poter *leggere* il codice per dirlo a voce in aula. Un hash non è
// reversibile, quindi lo lascerebbe a piedi ogni volta che se lo dimentica.
//
// Quello che conta per la sicurezza resta intatto: la chiave sta solo nelle
// variabili d'ambiente del server, e il codice in chiaro non compare mai
// nelle risposte pubbliche dell'API — solo nel pannello del relatore, dopo
// che il server ha verificato che chi chiede è davvero un relatore.
// (Difetto §7.2: nell'app attuale i codici di TUTTE le lezioni sono nel
// payload di /api/lezioni, che è pubblico.)

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function key(): Buffer {
  const raw = process.env.UNLOCK_CODE_KEY;
  if (!raw) {
    throw new Error("UNLOCK_CODE_KEY non impostata");
  }
  const parsed = Buffer.from(raw, "base64");
  if (parsed.length !== 32) {
    throw new Error("UNLOCK_CODE_KEY deve essere 32 byte in base64");
  }
  return parsed;
}

/** Normalizza come lo si detta a voce: maiuscolo, senza spazi ai bordi. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function encryptCode(code: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizeCode(code), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Restituisce il codice in chiaro, oppure null se il dato è corrotto o
 * cifrato con un'altra chiave. Da chiamare SOLO dopo aver verificato che
 * l'utente è un relatore.
 */
export function decryptCode(stored: string): string | null {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(ivHex, "hex"),
    );
    // Il tag di autenticazione fa fallire la decifratura se qualcuno ha
    // manomesso il valore nel database.
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Confronto a tempo costante fra il codice digitato e quello salvato. */
export function verifyCode(code: string, stored: string): boolean {
  const expected = decryptCode(stored);
  if (expected === null) return false;

  const a = Buffer.from(normalizeCode(code), "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual pretende buffer della stessa lunghezza: confrontarle
  // prima rivela solo la lunghezza del codice, non il suo contenuto.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
