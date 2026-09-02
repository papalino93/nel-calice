import { describe, expect, it } from "vitest";
import { isBlankCode, normalizeCode } from "./codes";

// Questi due non hanno bisogno di `UNLOCK_CODE_KEY`: la chiave serve solo a
// cifrare e decifrare, non a normalizzare. Per questo i test qui passano
// anche su una macchina appena clonata, a differenza di quelli in
// quiz.test.ts che la richiedono (§STATO.md, difetti nei test).

describe("normalizeCode", () => {
  it("porta in maiuscolo e toglie gli spazi ai bordi", () => {
    expect(normalizeCode("  calice26 ")).toBe("CALICE26");
  });

  it("non toglie gli spazi interni: fanno parte del codice dettato", () => {
    expect(normalizeCode(" sera uno ")).toBe("SERA UNO");
  });
});

describe("isBlankCode", () => {
  // Il caso che conta: un codice vuoto salvato sul corso rendeva vero il
  // confronto con qualunque stringa di soli spazi mandata da chiunque, e la
  // serata si sbloccava — o l'iscrizione passava — senza sapere nulla.
  it("riconosce come vuoto ciò che normalizza alla stringa vuota", () => {
    expect(isBlankCode("")).toBe(true);
    expect(isBlankCode(" ")).toBe(true);
    expect(isBlankCode("      ")).toBe(true);
    expect(isBlankCode("\t\n ")).toBe(true);
  });

  it("rifiuta ciò che non è nemmeno una stringa", () => {
    expect(isBlankCode(undefined)).toBe(true);
    expect(isBlankCode(null)).toBe(true);
    expect(isBlankCode(42)).toBe(true);
    expect(isBlankCode({})).toBe(true);
  });

  it("accetta un codice vero, anche con spazi intorno", () => {
    expect(isBlankCode("CALICE26")).toBe(false);
    expect(isBlankCode("  calice26  ")).toBe(false);
    // Un solo carattere è un codice povero, ma è un codice.
    expect(isBlankCode("A")).toBe(false);
  });
});
