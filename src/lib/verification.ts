import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { courseOverview } from "./course";
import { TOTAL_COURSE_POINTS, meritTitle, percentage } from "./scoring";

// Il codice di verifica dell'attestato.
//
// Un attestato stampato non dimostra niente da solo: chiunque sa aprire un
// PNG e cambiarci il nome. Il codice serve a questo — chi lo riceve apre
// /verifica/<codice> e legge dal server chi è davvero l'intestatario.
//
// ===========================================================================
// PERCHÉ NON È UNA COLONNA NUOVA
// ===========================================================================
//
// Il codice si **ricava** dall'id dell'iscrizione, non si salva: niente
// campo nuovo, niente migrazione, e gli attestati già consegnati hanno il
// loro codice fin da subito senza dover riempire nulla a posteriori.
//
// È composto di due metà:
//
//   · un LOCALIZZATORE — i primi 8 caratteri dell'id dell'iscrizione. Serve
//     solo a ritrovare la riga, e da solo non prova niente.
//   · una FIRMA — 40 bit di HMAC sull'id, con una chiave che sta solo sul
//     server. È quella che rende il codice non inventabile: conoscere il
//     localizzatore (o indovinarlo) non basta, perché la firma non si calcola
//     senza la chiave.
//
// Il prezzo di non salvarlo: un attestato non si può revocare singolarmente,
// perché non c'è una riga da spegnere. Per il tipo di documento — un ricordo
// di un corso amatoriale — è un prezzo che vale la migrazione risparmiata.
//
// La chiave non è `UNLOCK_CODE_KEY` così com'è: è derivata da quella con un
// HMAC su un'etichetta fissa. Serve a tenere separati i due usi — chi
// riuscisse a farsi firmare qualcosa da una parte non ottiene niente di
// spendibile dall'altra.

/** Base32 di Crockford: niente I, L, O, U — si confondono leggendo. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const LOCATOR_LENGTH = 8;
const SIGNATURE_LENGTH = 8; // 8 caratteri base32 = 40 bit
const CODE_LENGTH = LOCATOR_LENGTH + SIGNATURE_LENGTH;

function key(): Buffer {
  const raw = process.env.UNLOCK_CODE_KEY;
  if (!raw) throw new Error("UNLOCK_CODE_KEY non impostata");
  const parsed = Buffer.from(raw, "base64");
  if (parsed.length !== 32) {
    throw new Error("UNLOCK_CODE_KEY deve essere 32 byte in base64");
  }
  // Separazione di dominio: la chiave dei codici di sblocco e quella degli
  // attestati sono due chiavi diverse, derivate dallo stesso segreto.
  return createHmac("sha256", parsed).update("attestato/verifica/v1").digest();
}

/** 40 bit di firma, resi in 8 caratteri base32. */
function signature(enrollmentId: string): string {
  const digest = createHmac("sha256", key()).update(enrollmentId).digest();
  // Moltiplicazioni e divisioni, non scorrimenti di bit: gli operatori
  // bit a bit di JavaScript lavorano su 32 bit e taglierebbero via gli otto
  // più alti. 2^40 sta molto sotto il limite degli interi esatti, quindi
  // così i quaranta bit arrivano tutti interi.
  let bits = 0;
  for (let i = 0; i < 5; i++) bits = bits * 256 + digest[i];
  let out = "";
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    out = ALPHABET[bits % 32] + out;
    bits = Math.floor(bits / 32);
  }
  return out;
}

/** Il codice grezzo, 16 caratteri senza separatori. */
export function verificationCode(enrollmentId: string): string {
  return (
    enrollmentId.slice(0, LOCATOR_LENGTH).toUpperCase() +
    signature(enrollmentId)
  );
}

/** Come si stampa e si legge: quattro gruppi di quattro. */
export function formatVerificationCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * Riporta un codice scritto a mano alla sua forma grezza.
 * Tollera spazi, trattini e minuscole: viene copiato da un foglio stampato.
 */
function normalize(code: string): string | null {
  const clean = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  return clean.length === CODE_LENGTH ? clean : null;
}

function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Il codice appartiene davvero a questa iscrizione?
 *
 * Sta qui, separata dalla lettura del database, perché è la parte che decide
 * e l'unica che si può sbagliare in silenzio: va provata da sola.
 */
export function codeMatches(enrollmentId: string, code: string): boolean {
  const clean = normalize(code);
  if (!clean) return false;
  if (
    clean.slice(0, LOCATOR_LENGTH).toLowerCase() !==
    enrollmentId.slice(0, LOCATOR_LENGTH).toLowerCase()
  ) {
    return false;
  }
  return sameSignature(signature(enrollmentId), clean.slice(LOCATOR_LENGTH));
}

export type VerifiedCertificate = {
  name: string;
  courseTitle: string;
  meritTitle: string;
  /** Quando ha finito l'ultima lezione, non quando si guarda la pagina. */
  completedOn: Date | null;
};

/**
 * Cosa c'è dietro un codice, o null se non corrisponde a niente.
 *
 * Un solo esito negativo per ogni causa — codice malformato, iscrizione
 * inesistente, firma sbagliata, corso non finito: chi prova a indovinare non
 * deve poter capire *quanto* si è avvicinato.
 */
export async function verifyCertificate(
  code: string,
): Promise<VerifiedCertificate | null> {
  const clean = normalize(code);
  if (!clean) return null;

  const locator = clean.slice(0, LOCATOR_LENGTH).toLowerCase();

  // I cuid sono minuscoli, quindi il localizzatore rimesso in minuscolo è
  // il prefisso vero dell'id: la ricerca usa l'indice della chiave primaria
  // invece di scorrere tutte le iscrizioni. I candidati sono di norma uno —
  // ne servono più d'uno solo per due iscrizioni nate nello stesso istante.
  const candidates = await prisma.enrollment.findMany({
    where: { id: { startsWith: locator } },
    select: {
      id: true,
      courseId: true,
      user: { select: { name: true } },
      course: { select: { titleIt: true } },
    },
    take: 20,
  });

  const enrollment = candidates.find((c) => codeMatches(c.id, clean));
  if (!enrollment) return null;

  // La firma dice che il codice è autentico; non dice che il corso è finito.
  // Va ricontrollato adesso, con la stessa regola che concede l'attestato.
  const overview = await courseOverview({
    id: enrollment.id,
    courseId: enrollment.courseId,
  });
  if (!overview) return null;

  const required = overview.lessons;
  const done = required.filter((l) => l.status === "fatto");
  if (required.length === 0 || done.length < required.length) return null;

  // La data che conta è quella dell'ultima consegna, non `new Date()`: una
  // verifica fatta fra un anno deve dire la stessa cosa di una fatta oggi.
  const last = await prisma.quizAttempt.findFirst({
    where: { enrollmentId: enrollment.id, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true },
  });

  return {
    name: enrollment.user.name,
    courseTitle: enrollment.course.titleIt,
    meritTitle: meritTitle(
      percentage(overview.totalScore, TOTAL_COURSE_POINTS),
    ),
    completedOn: last?.submittedAt ?? null,
  };
}
