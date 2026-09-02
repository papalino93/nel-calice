import { describe, expect, it } from "vitest";
import {
  ANSWER_GRACE_MS,
  attemptDeadline,
  grade,
  isExpired,
  secondsRemaining,
  shuffle,
  type GradableQuestion,
} from "./quiz";
import { decryptCode, encryptCode, normalizeCode, verifyCode } from "./codes";

describe("timer del tentativo", () => {
  const start = new Date("2026-08-07T18:00:00.000Z");

  it("fissa la scadenza a partire dall'avvio", () => {
    expect(attemptDeadline(start, 15)).toEqual(
      new Date("2026-08-07T18:15:00.000Z"),
    );
    expect(attemptDeadline(start, 45)).toEqual(
      new Date("2026-08-07T18:45:00.000Z"),
    );
  });

  it("sopravvive a un refresh: la scadenza non dipende da quando la si guarda", () => {
    const deadline = attemptDeadline(start, 15);

    // Un minuto dopo l'avvio restano 14 minuti, non di nuovo 15.
    const oneMinuteIn = new Date("2026-08-07T18:01:00.000Z");
    expect(secondsRemaining(deadline, oneMinuteIn)).toBe(14 * 60);

    // Ricalcolando la scadenza dallo stesso avvio si ottiene lo stesso valore.
    expect(attemptDeadline(start, 15)).toEqual(deadline);
  });

  it("considera scaduto solo ciò che è oltre il termine", () => {
    const deadline = attemptDeadline(start, 15);
    expect(isExpired(deadline, new Date("2026-08-07T18:14:59.000Z"))).toBe(false);
    expect(isExpired(deadline, new Date("2026-08-07T18:15:00.000Z"))).toBe(false);
    expect(isExpired(deadline, new Date("2026-08-07T18:15:01.000Z"))).toBe(true);
  });

  it("tollera un piccolo ritardo di rete, ma non un'attesa", () => {
    const deadline = attemptDeadline(start, 15);
    const justLate = new Date(deadline.getTime() + 2_000);
    const wayLate = new Date(deadline.getTime() + 60_000);

    expect(isExpired(deadline, justLate, ANSWER_GRACE_MS)).toBe(false);
    expect(isExpired(deadline, wayLate, ANSWER_GRACE_MS)).toBe(true);
  });

  it("non mostra mai secondi negativi", () => {
    const deadline = attemptDeadline(start, 15);
    expect(secondsRemaining(deadline, new Date("2026-08-07T19:00:00.000Z"))).toBe(0);
  });
});

describe("mescolamento delle opzioni", () => {
  it("conserva tutte le opzioni, senza perderne né duplicarne", () => {
    const options = [1, 2, 3, 4];
    const shuffled = shuffle(options, () => 0.42);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4]);
  });

  it("non altera l'array di partenza", () => {
    const options = [1, 2, 3, 4];
    shuffle(options);
    expect(options).toEqual([1, 2, 3, 4]);
  });
});

describe("correzione", () => {
  const questions: GradableQuestion[] = [
    { questionId: 10, correctOptionId: 101, points: 2 },
    { questionId: 11, correctOptionId: 111, points: 2 },
    { questionId: 12, correctOptionId: 121, points: 1 },
  ];

  it("assegna i punti della domanda solo se la risposta è quella corretta", () => {
    const result = grade(
      questions,
      new Map([
        [10, 101], // giusta
        [11, 112], // sbagliata
        [12, 121], // giusta
      ]),
    );

    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(5);
    expect(result.answers.map((a) => a.isCorrect)).toEqual([true, false, true]);
    expect(result.answers.map((a) => a.pointsAwarded)).toEqual([2, 0, 1]);
  });

  it("tratta una domanda lasciata in bianco come zero punti, non come errore di sistema", () => {
    const result = grade(questions, new Map([[10, 101]]));

    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(5);

    const blank = result.answers.find((a) => a.questionId === 11)!;
    expect(blank.selectedOptionId).toBeNull();
    expect(blank.isCorrect).toBe(false);
    expect(blank.pointsAwarded).toBe(0);
  });

  it("dà zero a un quiz scaduto senza nessuna risposta salvata", () => {
    const result = grade(questions, new Map());
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.answers).toHaveLength(3);
  });

  it("dà il massimo a chi risponde tutto correttamente", () => {
    const result = grade(
      questions,
      new Map([
        [10, 101],
        [11, 111],
        [12, 121],
      ]),
    );
    expect(result.score).toBe(result.maxScore);
    expect(result.score).toBe(5);
  });

  it("ignora risposte a domande che non fanno parte del quiz", () => {
    const result = grade(questions, new Map([[999, 9999]]));
    expect(result.answers).toHaveLength(3);
    expect(result.score).toBe(0);
  });

  it("non lascia nessuna domanda a costo zero quando i punti non bastano per una a testa", () => {
    // Caso reale segnalato: budget di lezione troppo piccolo per il numero
    // di domande (distributeEvenly(3, 8) → [1,1,1,0,0,0,0,0]). Con la somma
    // per-domanda di prima, indovinare solo le ultime cinque valeva 0 — qui
    // deve contare comunque.
    const many: GradableQuestion[] = [
      { questionId: 1, correctOptionId: 1, points: 1 },
      { questionId: 2, correctOptionId: 1, points: 1 },
      { questionId: 3, correctOptionId: 1, points: 1 },
      { questionId: 4, correctOptionId: 1, points: 0 },
      { questionId: 5, correctOptionId: 1, points: 0 },
      { questionId: 6, correctOptionId: 1, points: 0 },
      { questionId: 7, correctOptionId: 1, points: 0 },
      { questionId: 8, correctOptionId: 1, points: 0 },
    ];

    // Indovina solo le cinque domande "da zero punti", sbaglia le altre tre.
    const onlyZeroPointOnes = grade(
      many,
      new Map([
        [4, 1],
        [5, 1],
        [6, 1],
        [7, 1],
        [8, 1],
      ]),
    );
    expect(onlyZeroPointOnes.maxScore).toBe(3);
    expect(onlyZeroPointOnes.score).toBeGreaterThan(0);

    // Rispondere a più domande giuste (anche fra quelle "da zero") deve
    // valere di più, non restare uguale.
    const allEight = grade(many, new Map(many.map((q) => [q.questionId, 1])));
    expect(allEight.score).toBe(3);
    expect(allEight.score).toBeGreaterThan(onlyZeroPointOnes.score);
  });
});

describe("codici di sblocco", () => {
  it("accetta il codice giusto scritto come capita", () => {
    const stored = encryptCode("ARCHETTI");
    expect(verifyCode("ARCHETTI", stored)).toBe(true);
    expect(verifyCode("archetti", stored)).toBe(true);
    expect(verifyCode("  Archetti  ", stored)).toBe(true);
  });

  it("rifiuta un codice sbagliato", () => {
    const stored = encryptCode("ARCHETTI");
    expect(verifyCode("BARRIQUE", stored)).toBe(false);
    expect(verifyCode("ARCHETT", stored)).toBe(false);
    expect(verifyCode("", stored)).toBe(false);
  });

  it("nel database il codice non è leggibile in chiaro", () => {
    const stored = encryptCode("ARCHETTI");
    expect(stored).not.toContain("ARCHETTI");
    expect(stored.toUpperCase()).not.toContain("ARCHETTI");
  });

  it("il relatore può però rileggerlo, per dirlo a voce in aula", () => {
    expect(decryptCode(encryptCode("archetti"))).toBe("ARCHETTI");
  });

  it("produce cifrati diversi per lo stesso codice, grazie all'IV casuale", () => {
    expect(encryptCode("TANNINO")).not.toBe(encryptCode("TANNINO"));
  });

  it("rifiuta un valore manomesso nel database", () => {
    const stored = encryptCode("ARCHETTI");
    const [iv, tag, data] = stored.split(":");
    // Cambia un carattere del testo cifrato: il tag di autenticazione
    // di GCM se ne accorge e la decifratura fallisce invece di
    // restituire spazzatura.
    const flipped = data[0] === "a" ? `b${data.slice(1)}` : `a${data.slice(1)}`;
    const tampered = [iv, tag, flipped].join(":");

    expect(decryptCode(tampered)).toBeNull();
    expect(verifyCode("ARCHETTI", tampered)).toBe(false);
  });

  it("non esplode su un valore malformato", () => {
    expect(verifyCode("ARCHETTI", "spazzatura")).toBe(false);
    expect(verifyCode("ARCHETTI", "")).toBe(false);
    expect(verifyCode("ARCHETTI", "abc:def")).toBe(false);
    expect(decryptCode("abc:def:ghi")).toBeNull();
  });

  it("normalizza come lo si detta a voce", () => {
    expect(normalizeCode("  perlage ")).toBe("PERLAGE");
  });
});
