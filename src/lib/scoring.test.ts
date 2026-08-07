import { describe, expect, it } from "vitest";
import {
  computeBudgets,
  describeLessonScoring,
  distributeEvenly,
  meritTitle,
  percentage,
  totalAssignablePoints,
  type LessonForScoring,
} from "./scoring";

/** Comodità: costruisce le lezioni di un corso con le domande indicate. */
function course(
  questionCounts: number[],
  opts: { examLast?: boolean } = {},
): LessonForScoring[] {
  const examLast = opts.examLast ?? false;
  return questionCounts.map((questionCount, i) => ({
    id: `cl${i + 1}`,
    isExam: examLast && i === questionCounts.length - 1,
    questionCount,
  }));
}

/** L'assetto storico: 5 lezioni da 8 domande + prova finale da 30. */
const baseCourse = course([8, 8, 8, 8, 8, 30], { examLast: true });

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

describe("assetto storico: 5 lezioni + prova finale", () => {
  const budgets = computeBudgets(baseCourse);

  it("dà 8 punti a ogni lezione normale, 1 per domanda", () => {
    for (const lesson of budgets.filter((b) => !b.isExam)) {
      expect(lesson.budget).toBe(8);
      expect(lesson.questionPoints).toEqual(new Array(8).fill(1));
    }
  });

  it("dà 60 punti alla prova finale, 2 per domanda", () => {
    const exam = budgets.find((b) => b.isExam)!;
    expect(exam.budget).toBe(60);
    expect(exam.questionPoints).toEqual(new Array(30).fill(2));
  });

  it("somma esattamente 100", () => {
    expect(totalAssignablePoints(baseCourse)).toBe(100);
  });
});

describe("l'invariante dei 100 punti regge per qualunque corso", () => {
  it("con un numero qualsiasi di lezioni e di domande, con esame", () => {
    for (let lessonCount = 1; lessonCount <= 12; lessonCount++) {
      for (let questionsEach = 1; questionsEach <= 15; questionsEach++) {
        const lessons = course(
          new Array(lessonCount).fill(questionsEach),
          { examLast: true },
        );
        expect(totalAssignablePoints(lessons)).toBe(100);

        for (const budget of computeBudgets(lessons)) {
          const sum = budget.questionPoints.reduce((a, b) => a + b, 0);
          expect(sum).toBe(budget.budget);
        }
      }
    }
  });

  it("e anche senza esame — un corso tematico può non averne", () => {
    for (let lessonCount = 1; lessonCount <= 12; lessonCount++) {
      for (let questionsEach = 1; questionsEach <= 15; questionsEach++) {
        const lessons = course(new Array(lessonCount).fill(questionsEach));
        expect(totalAssignablePoints(lessons)).toBe(100);
      }
    }
  });
});

describe("corsi di forma diversa dallo stesso catalogo", () => {
  it("corso da una sola lezione: quella lezione vale 100", () => {
    const lessons = course([10]);
    const [only] = computeBudgets(lessons);

    expect(only.budget).toBe(100);
    expect(only.questionPoints).toEqual(new Array(10).fill(10));
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("corso breve da due lezioni: 50 e 50", () => {
    const lessons = course([5, 5]);
    const budgets = computeBudgets(lessons);

    expect(budgets.map((b) => b.budget)).toEqual([50, 50]);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("corso da due lezioni di cui una è la prova finale: 40 e 60", () => {
    const lessons = course([5, 20], { examLast: true });
    const budgets = computeBudgets(lessons);

    expect(budgets[0].budget).toBe(40);
    expect(budgets[1].budget).toBe(60);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("la stessa lezione pesa diversamente a seconda del corso", () => {
    // 8 domande, da sola in un corso tematico…
    const alone = computeBudgets(course([8]))[0];
    // …e dentro il corso completo.
    const inFullCourse = computeBudgets(baseCourse)[0];

    expect(alone.budget).toBe(100);
    expect(inFullCourse.budget).toBe(8);
    // È esattamente il motivo per cui i punti non sono salvati sulla lezione.
  });
});

describe("lezioni senza domande", () => {
  it("non ricevono punti, e il totale resta 100", () => {
    const lessons = course([8, 0, 8, 20], { examLast: true });
    const budgets = computeBudgets(lessons);

    expect(budgets[1].budget).toBe(0);
    expect(budgets[1].questionPoints).toEqual([]);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("se la prova finale non ha ancora domande, i 100 punti vanno alle lezioni", () => {
    const lessons = course([5, 5, 0], { examLast: true });
    const budgets = computeBudgets(lessons);

    expect(budgets[2].budget).toBe(0);
    expect(budgets[0].budget).toBe(50);
    expect(budgets[1].budget).toBe(50);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("se solo la prova finale ha domande, vale 100 da sola", () => {
    const lessons = course([0, 25], { examLast: true });
    expect(computeBudgets(lessons).find((b) => b.isExam)!.budget).toBe(100);
    expect(totalAssignablePoints(lessons)).toBe(100);
  });

  it("un corso ancora vuoto vale 0, senza fingere", () => {
    expect(totalAssignablePoints([])).toBe(0);
    expect(totalAssignablePoints(course([0]))).toBe(0);
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
    // 40 punti a una sola lezione normale, divisi su 3 domande: 14/13/13.
    const [first] = computeBudgets(course([3, 10], { examLast: true }));
    expect(describeLessonScoring(first)).toBe(
      "3 domande · 40 punti (14 o 13 a domanda)",
    );
  });

  it("è esplicito sulle lezioni ancora senza domande", () => {
    const [empty] = computeBudgets(course([0, 4]));
    expect(describeLessonScoring(empty)).toBe("nessuna domanda · 0 punti");
  });
});

describe("fasce di merito", () => {
  it("sono calcolate in percentuale, non in punti assoluti", () => {
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
