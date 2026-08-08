import { describe, expect, it } from "vitest";

// La chiave è impostata **prima** di importare il modulo: il codice di
// verifica la legge da process.env, e senza questa riga il test dipenderebbe
// dall'ambiente di chi lo esegue — che è esattamente il difetto per cui sei
// test del progetto falliscono su una macchina appena clonata.
process.env.UNLOCK_CODE_KEY = Buffer.alloc(32, 7).toString("base64");

const { codeMatches, formatVerificationCode, verificationCode } = await import(
  "./verification"
);

// Un id plausibile: i cuid sono minuscoli, alfanumerici, senza trattini.
const ID = "clx3k9p20000abcd1efgh2ij";
const OTHER = "clx3k9p20000zzzz9wxyz8kl";

describe("codice di verifica dell'attestato", () => {
  it("è stabile: la stessa iscrizione dà sempre lo stesso codice", () => {
    expect(verificationCode(ID)).toBe(verificationCode(ID));
  });

  it("è lungo sedici caratteri, che stampati diventano quattro gruppi", () => {
    const code = verificationCode(ID);
    expect(code).toHaveLength(16);
    expect(formatVerificationCode(code)).toMatch(
      /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/,
    );
  });

  it("riconosce il proprio codice, nella forma grezza e in quella stampata", () => {
    const code = verificationCode(ID);
    expect(codeMatches(ID, code)).toBe(true);
    expect(codeMatches(ID, formatVerificationCode(code))).toBe(true);
  });

  it("perdona come viene ricopiato da un foglio", () => {
    const printed = formatVerificationCode(verificationCode(ID));
    expect(codeMatches(ID, printed.toLowerCase())).toBe(true);
    expect(codeMatches(ID, `  ${printed}  `)).toBe(true);
    expect(codeMatches(ID, printed.replace(/-/g, " "))).toBe(true);
    expect(codeMatches(ID, printed.replace(/-/g, ""))).toBe(true);
  });

  it("non accetta il codice di un'altra iscrizione", () => {
    expect(codeMatches(OTHER, verificationCode(ID))).toBe(false);
  });

  it("non accetta una firma ritoccata, nemmeno di un carattere", () => {
    const code = verificationCode(ID);
    // Si cambia l'ultimo carattere in un altro dell'alfabeto: il
    // localizzatore resta giusto, quindi passa solo se la firma non conta.
    const last = code.slice(-1);
    const tampered = code.slice(0, -1) + (last === "0" ? "1" : "0");
    expect(tampered).not.toBe(code);
    expect(codeMatches(ID, tampered)).toBe(false);
  });

  it("non accetta un codice troncato o allungato", () => {
    const code = verificationCode(ID);
    expect(codeMatches(ID, code.slice(0, 15))).toBe(false);
    expect(codeMatches(ID, `${code}X`)).toBe(false);
    expect(codeMatches(ID, "")).toBe(false);
  });

  it("il localizzatore da solo non basta: la firma è ciò che prova", () => {
    // Chi conoscesse l'inizio dell'id — o lo indovinasse — non deve poterne
    // ricavare un codice valido riempiendo il resto a caso.
    const guess = ID.slice(0, 8).toUpperCase() + "00000000";
    expect(codeMatches(ID, guess)).toBe(false);
  });
});
