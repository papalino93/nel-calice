# Stato del progetto

Documento di ripresa: chi arriva qui — persona o assistente, su qualsiasi
macchina o account — deve poter riprendere senza farsi raccontare niente.
Va aggiornato quando cambia lo stato, non a ogni commit.

**Dove vive:** repo [papalino93/nuovo-corso-vino](https://github.com/papalino93/nuovo-corso-vino) ·
produzione <https://nuovo-corso-vino.vercel.app> · database Neon Postgres ·
dispense su Vercel Blob (store privato `dispense`).

## Cos'è

Il corso di degustazione: gli iscritti seguono le serate, ogni serata si apre
con un codice detto in aula, si risponde a un quiz a tempo, e alla fine si
scarica un attestato. Il relatore prepara le serate, scrive le domande, apre e
chiude le lezioni e segue l'andamento della classe.

Riscrittura di una versione precedente (`corso-vino-quiz`), fatta per togliere
i difetti che quella aveva per costruzione. Vale la pena ricordarli, perché
sono il motivo di quasi ogni scelta di architettura qui dentro:

| Difetto di prima | Come è risolto qui |
|---|---|
| PIN del relatore in chiaro | nessun PIN: il ruolo si ricava a ogni richiesta confrontando l'email con `ADMIN_EMAILS`, non è un campo modificabile |
| codici di sblocco spediti al client | restano cifrati sul server (`src/lib/codes.ts`); il client riceve solo aperto/chiuso |
| punteggio calcolato nel browser | `AttemptAnswer.pointsAwarded` lo scrive solo il server alla consegna |
| domande ispezionabili | l'API del quiz non emette mai `isCorrect` prima della consegna |
| timer non persistente | `QuizAttempt.expiresAt` è scritto alla creazione: un refresh rilegge la stessa scadenza |
| dati del corso dentro il record del singolo utente | entità separate con vincoli a database |
| attestato in tre copie divergenti | una sola sorgente SVG per schermo, PNG e stampa |

## L'architettura, in una riga

**Catalogo → corso → iscrizione.** Sono tre livelli distinti, ed è la scelta
portante:

- **Catalogo** (`Lesson`, `Question`, `Option`, `Material`): il contenuto, che
  esiste indipendentemente da chi lo usa. Una lezione scritta una volta serve
  più edizioni.
- **Corso** (`Course`, `CourseLesson`): l'edizione. `CourseLesson` è il
  collegamento, e porta ciò che è specifico di *quella* serata: numero, codice
  di sblocco, se è la prova finale.
- **Iscrizione** (`Enrollment`, `LessonUnlock`, `QuizAttempt`,
  `AttemptAnswer`): la storia del singolo corsista dentro una singola edizione.

Lo stesso catalogo regge già due corsi di forma diversa. I vincoli che
impediscono di mescolarli sono imposti dal database, non dal codice — vedi le
migrazioni in `prisma/migrations/` e `npm run test:db`.

Due garanzie non ovvie, da non rompere:

- **I numeri delle serate non scorrono.** Togliere la lezione 4 fa sparire il
  4; la 5 resta la 5.
- **Togliere una lezione da un corso non la cancella dal catalogo.** Resta per
  le altre edizioni, con domande e dispense.

Il punteggio è sempre 100, ripartito fra serate e prova finale senza
arrotondamenti persi: `src/lib/scoring.ts`, funzione pura e testata.

## Mappa del codice

```
prisma/schema.prisma          entità e vincoli — si parte sempre da qui
src/lib/       admin, quiz, scoring, codes, unlock, materials, certificate,
               auth, roles, guard, enrollment, i18n
src/app/       corso/[slug]/…      quello che vede il corsista
               relatore/…          catalogo, corso, andamento della classe
               api/…               le rotte, divise fra admin e corsista
src/components/                    UI, incluso Certificate e AdminShell
DESIGN.md                          identità visiva, da conservare
```

## Variabili d'ambiente

Nessuna sta nel repo (`.env*` è ignorato). Vanno impostate in ogni ambiente che
esegue l'app; in produzione sono già su Vercel.

| Variabile | A cosa serve |
|---|---|
| `DATABASE_URL` | Neon Postgres, connessione con pool |
| `POSTGRES_URL_NON_POOLING` | connessione diretta, serve alle migrazioni |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | accesso con Google |
| `AUTH_SECRET` | firma della sessione (Auth.js) |
| `ADMIN_EMAILS` | elenco delle email che valgono come relatore |
| `UNLOCK_CODE_KEY` | 32 byte in base64: cifra i codici di sblocco |
| `BLOB_READ_WRITE_TOKEN` | store privato delle dispense |

Senza `UNLOCK_CODE_KEY` sei test falliscono: non è una regressione, è
l'ambiente incompleto.

## Ripartire su una macchina nuova

```bash
git clone https://github.com/papalino93/nuovo-corso-vino && cd nuovo-corso-vino
npm install                 # genera anche il client Prisma
vercel env pull             # scarica le variabili dal progetto Vercel
npx prisma migrate deploy   # solo se il database è vuoto
npm run dev
```

Verifiche: `npm test` (unità), `npm run lint`, `npm run build`,
`npm run test:db` (vincoli, richiede un database).

## Cosa è fatto

Tutto provato dal vivo, non solo compilato: accesso con Google, iscrizione col
codice, sblocco della serata, quiz a tempo con correzione sul server, risultato
con revisione, attestato scaricabile in PNG, pannello relatore completo (corsi,
catalogo, domande, andamento della classe) e dispense con caricamento diretto e
accesso protetto.

Fa eccezione una cosa, scritta ma **mai provata dal vivo**: dalla pagina del
corso il relatore può ora scrivere una lezione nuova sul posto, senza passare
dal catalogo (resta comunque riusabile, e l'interfaccia lo dice). Test, lint e
build sono verdi, ma nessuno l'ha ancora cliccata con un database vero.

## Cosa resta

1. **Provare il nuovo modo di aggiungere una serata**, sopra: crearne una,
   controllare che compaia in catalogo, e che un codice già usato nella stessa
   edizione dia errore senza lasciare in giro una lezione a metà.
2. **Controllo bug e resa su telefono, tablet e computer.** Non ancora fatto:
   richiede occhi veri sui tre formati, non basta la revisione del codice.
2. **Ruotare il token dello store dispense** — era finito in chiaro in uno
   screenshot (mai nel repo: la cronologia di git è pulita). Si fa dal pannello
   Vercel: Storage → `dispense` → Settings → **Rotate Credentials**, scegliendo
   **scadenza immediata** delle vecchie credenziali — il ritardo fino a 30
   giorni che propone terrebbe in vita proprio il token da uccidere. Store,
   file e collegamenti restano al loro posto; le variabili dei progetti
   collegati le aggiorna Vercel. Serve poi un **redeploy**, perché le variabili
   si leggono all'avvio, e un `vercel env pull` per riallineare il `.env`
   locale.

   *Non* cancellare e ricreare lo store: era il piano prima di sapere che
   Rotate Credentials esiste, ed è inutilmente distruttivo.
