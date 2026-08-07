import { describe, expect, it } from "vitest";
import {
  computeBudgets,
  describeLessonScoring,
  distributeEvenly,
  examLessonId,
  meritTitle,
  percentage,
  totalAssignablePoints,
  type LessonForScoring,
} from "./scoring";

/** L'assetto storico: 5 lezioni da 8 domande + esame finale da 30. */
const baseCourse: LessonForScoring[] = [
  { id: 1, questionCount: 8 },
  { id: 2, questionCount: 8 },
  { id: 3, questionCount: 8 },
  { id: 4, questionCount: 8 },
  { id: 5, questionCount: 8 },
  { id: 6, questionCount: 30 },
];

describe("distributeEvenly", () => {
  it("divide senza resto quando il totale è divisibile", () => {
    expect(distributeEvenly(40, 5)).toEqual([8, 8, 8, 8, 8]);
  });

  it("non perde né inventa punti quando la divisione non è esatta", () => {
    const split = distributeEvenly(40, 6);
    expect(split).toEqual([7, 7, 7, 7, 6, 6]);
    expect(split.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("distribuisce sempre in modo esatto, per qualunque combinazione", () => {
    for (let total = 0; total <= 100; total++) {
      for (let count = 1; count <= 25; count++) {
        const split = distributeEvenly(total, count);
        expect(split).toHaveLength(count);
        expect(split.reduce((a, b) => a + b, 0)).toBe(total);
        // Nessuna voce differisce da un'altra per più di un punto.
        expect(Math.max(...split) - Math.min(...split)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("regge i casi degeneri senza esplodere", () => {
    expect(distributeEvenly(100, 0)).toEqual([]);
    expect(distributeEvenly(0, 3)).toEqual([0, 0, 0]);
  });
});

describe("examLessonId", () => {
  it("è la lezione con id più alto", () => {
    expect(examLessonId(baseCourse)).toBe(6);
  });

  it("resta la stessa dopo aver cancellato una lezione in mezzo", () => {
    const withoutFour = baseCourse.filter((l) => l.id !== 4);
    expect(examLessonId(withoutFour)).toBe(6);
  });

  it("è null se non ci sono lezioni", () => {
    expect(examLessonId([])).toBeNull();
  });
});

describe("computeBudgets — assetto storico", () => {
  const budgets = computeBudgets(baseCourse);

  it("dà 8 punti a ogni lezione normale, 1 per domanda", () => {
    for (const lesson of budgets.filter((b) => !b.isExam)) {
      expect(lesson.budget).toBe(8);
      expect(lesson.questionPoints).toEqual(new Array(8).fill(1));
    }
  });

  it("dà 60 punti all'esame, 2 per domanda", () => {
    const exam = budgets.find((b) => b.isExam)!;
    expect(exam.budget).toBe(60);
    expect(exam.questionPoints).toEqual(new Array(30).fill(2));
  });

  it("somma esattamente 100", () => {
    expect(totalAssignablePoints(baseCourse)).toBe(100);
  });
});

describe("computeBudgets — l'invariante dei 100 punti regge sempre", () => {
  it("con un numero qualsiasi di lezioni e di domande", () => {
    for (let lessonCount = 1; lessonCount <= 12; lessonCount++) {
      for (let questionsEach = 1; questionsEach <= 15; questionsEach++) {
        const lessons: LessonForScoring[] = Array.from(
          { length: lessonCount },
          (_, i) => ({ id: i + 1, questionCount: questionsEach }),
        );
        expect(totalAssignablePoints(lessons)).toBe(100);

        // Anche la ripartizione interna a ogni lezione deve essere esatta.
        for (const budget of computeBudgets(lessons)) {
          const sum = budget.questionPoints.reduce((a, b) => a + b, 0);
          expect(sum).toBe(budget.budget);
        }
      }
    }
  });

  it("dopo aver cancellato una lezione in mezzo", () => {
    const withoutFour = baseCourse.filter((l) => l.id !== 4);
    expect(totalAssignablePoints(withoutFour)).toBe(100);

    // Le lezioni superstiti non scorrono: gli id restano quelli di prima.
    const ids = computeBudgets(withoutFour).map((b) => b.lessonId);
    expect(ids).toEqual([1, 2, 3, 5, 6]);
  });

  it("dopo aver aggiunto una lezione, che diventa il nuovo esame", () => {
    const extended = [...baseCourse, { id: 7, questionCount: 10 }];
    const budgets = computeBudgets(extended);

    expect(budgets.find((b) => b.lessonId === 7)!.isExam).toBe(true);
    expect(budgets.find((b) => b.lessonId === 6)!.isExam).toBe(false);
    expect(totalAssignablePoints(extended)).toBe(100);
  });
});

describe("computeBudgets — lezioni senza domande", () => {
  it("non assegna punti a una lezione vuota, e il totale resta 100", () => {
    const lessons: LessonForScoring[] = [
      { id: 1, questionCount: 8 },
      { id: 2, questionCount: 0 }, // "in arrivo"
      { id: 3, questionCount: 8 },
      { id: 4, questionCount: 20 },
    ];
    const budgets = computeBudgets(lessons);

    expect(budgets.find((b) => b.lessonId === 2)!.budget).toBe(0);
    expect(budgets.find((b) => b.lessonId === 2)!.questionPoints).toEqual([]);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("dà tutti i 100 punti alle lezioni quando l'esame non ha ancora domande", () => {
    const lessons: LessonForScoring[] = [
      { id: 1, questionCount: 5 },
      { id: 2, questionCount: 5 },
      { id: 3, questionCount: 0 }, // esame non ancora scritto
    ];
    const budgets = computeBudgets(lessons);

    expect(budgets.find((b) => b.lessonId === 3)!.budget).toBe(0);
    expect(budgets.find((b) => b.lessonId === 1)!.budget).toBe(50);
    expect(budgets.find((b) => b.lessonId === 2)!.budget).toBe(50);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("dà 100 punti all'esame quando è l'unica lezione con domande", () => {
    const lessons: LessonForScoring[] = [
      { id: 1, questionCount: 0 },
      { id: 2, questionCount: 25 },
    ];
    expect(computeBudgets(lessons).find((b) => b.isExam)!.budget).toBe(100);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("assegna 0 punti a un corso ancora completamente vuoto", () => {
    expect(totalAssignablePoints([])).toBe(0);
    expect(totalAssignablePoints([{ id: 1, questionCount: 0 }])).toBe(0);
  });
});

describe("describeLessonScoring", () => {
  it("descrive una ripartizione uniforme", () => {
    const [lesson] = computeBudgets(baseCourse);
    expect(describeLessonScoring(lesson)).toBe(
      "8 domande · 8 punti (1 a domanda)",
    );
  });

  it("segnala quando le domande non valgono tutte uguale", () => {
    const lessons: LessonForScoring[] = [
      { id: 1, questionCount: 3 },
      { id: 2, questionCount: 10 },
    ];
    // 40 punti a una sola lezione normale, divisi su 3 domande: 14/13/13.
    const [first] = computeBudgets(lessons);
    expect(describeLessonScoring(first)).toBe(
      "3 domande · 40 punti (14 o 13 a domanda)",
    );
  });

  it("è esplicito sulle lezioni ancora senza domande", () => {
    const lessons: LessonForScoring[] = [
      { id: 1, questionCount: 0 },
      { id: 2, questionCount: 4 },
    ];
    const [empty] = computeBudgets(lessons);
    expect(describeLessonScoring(empty)).toBe("nessuna domanda · 0 punti");
  });
});

describe("fasce di merito", () => {
  it("sono calcolate in percentuale, non in punti assoluti", () => {
    // Stesso 90%, massimi diversi: stesso titolo.
    expect(meritTitle(percentage(90, 100))).toBe("Palato d'Oro");
    expect(meritTitle(percentage(9, 10))).toBe("Palato d'Oro");
    expect(meritTitle(percentage(45, 50))).toBe("Palato d'Oro");
  });

  it("copre tutte le fasce", () => {
    expect(meritTitle(100)).toBe("Palato d'Oro");
    expect(meritTitle(85)).toBe("Palato d'Oro");
    expect(meritTitle(84.9)).toBe("Naso Fine");
    expect(meritTitle(70)).toBe("Naso Fine");
    expect(meritTitle(69.9)).toBe("Bevitore Curioso");
    expect(meritTitle(50)).toBe("Bevitore Curioso");
    expect(meritTitle(49.9)).toBe("Amico del Calice");
    expect(meritTitle(0)).toBe("Amico del Calice");
  });

  it("non divide per zero su un massimo nullo", () => {
    expect(percentage(0, 0)).toBe(0);
    expect(meritTitle(percentage(0, 0))).toBe("Amico del Calice");
  });
});
