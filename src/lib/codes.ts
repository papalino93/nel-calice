import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// I codici di sblocco non vengono mai salvati in chiaro e non lasciano mai
// il server (difetto §7.2: nell'app attuale sono nel payload pubblico di
// /api/lezioni, quindi un corsista può leggerli e sbloccare tutto).
//
// Sono parole corte e prevedibili ("ARCHETTI", "BARRIQUE"), quindi un hash
// veloce non basterebbe: scrypt è volutamente costoso da calcolare.

const KEY_LENGTH = 32;

/** Normalizza come lo si digita a voce: maiuscolo, senza spazi ai bordi. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashCode(code: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(normalizeCode(code), salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Confronto a tempo costante: un confronto normale rivelerebbe, dalla durata
 * della risposta, quanti caratteri iniziali sono corretti.
 */
export function verifyCode(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const derived = scryptSync(
    normalizeCode(code),
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
  );
  return timingSafeEqual(derived, expected);
}
