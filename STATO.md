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
| `ANTHROPIC_API_KEY` | traduzione automatica dei testi del catalogo |

`ANTHROPIC_API_KEY` è l'unica facoltativa: senza, tutto il resto funziona e il
pulsante «Traduci in inglese» risponde che non è configurato, invece di dare
errore.

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

Verifiche: `npm test` (unità), `npm run lint`, `npm run build`.

Le due che parlano con un database vero, e che **non** sono la stessa cosa:

| Comando | Cosa fa | Dove si può puntare |
|---|---|---|
| `npm run check:schema` | **Solo letture.** Stampa a quale database si è connesso, elenca le migrazioni applicate e controlla che le colonne che il codice si aspetta ci siano davvero, anche attraverso il client Prisma generato | ovunque, **produzione compresa** |
| `npm run test:db` | Crea e cancella righe di prova per verificare i vincoli e il giro relatore→corsista | **solo sviluppo** |

`check:schema` risponde in un comando alla domanda che dopo ogni migrazione
torna sempre — *l'ho lanciata sul database giusto?* — perché la prima riga che
stampa è l'host a cui si è connesso.

## Come va in produzione

Vercel distribuisce da sé a ogni push su `main`: non c'è nessun pulsante da
premere. Quindi «mandare in produzione» vuol dire unire su `main` e pushare, e
chi lavora qui **porta il lavoro fino in fondo** invece di fermarsi al proprio
ramo.

L'eccezione è una sola, ed è quella che conta: **se il lavoro porta una
migrazione, prima si migra il database di produzione e solo dopo si unisce.**
Nell'ordine inverso il codice nuovo arriva davanti a una colonna che non
esiste ancora, e ogni pagina che la tocca risponde 500 per tutto il tempo che
passa fra il deploy e la migrazione. Il ramo `certificate-branding-ready` è
fermo esattamente per questo, e la migrazione della spiegazione è stata
lanciata in quest'ordine apposta.

Prima di unire, la verifica che costa dieci secondi:

```bash
git diff --stat origin/main..<ramo> -- prisma/
```

Se stampa qualcosa, c'è una migrazione da lanciare prima. Se non stampa
niente, si unisce e basta.

## Le dispense non hanno più un segreto da proteggere

Vale la pena saperlo prima di toccare quella parte. Lo store `dispense` è
collegato al progetto, e il progetto si autentica con **OIDC**: credenziali a
vita brevissima che Vercel rinnova da sé. Il vecchio `BLOB_READ_WRITE_TOKEN` è
stato **revocato**, e le dispense continuano a caricarsi e ad aprirsi — provato
in produzione dopo la revoca.

Quindi: non reintrodurre un token statico per comodità. L'SDK lo userebbe solo
se OIDC mancasse (`resolveBlobAuth` prova OIDC per primo), e sarebbe di nuovo
un segreto da custodire — l'errore da cui questo progetto è appena uscito.

In sviluppo locale il token OIDC arriva con `vercel env pull` ed è a scadenza
breve: se le dispense smettono di funzionare sulla propria macchina, di norma è
solo quello scaduto e basta rifare il pull.

## Cosa è fatto

Tutto provato dal vivo, non solo compilato: accesso con Google, iscrizione col
codice, sblocco della serata, quiz a tempo con correzione sul server, risultato
con revisione, attestato scaricabile in PNG, pannello relatore completo (corsi,
catalogo, domande, andamento della classe) e dispense con caricamento diretto e
accesso protetto.

**La spiegazione dopo la risposta è provata contro un Postgres vero**, non
solo compilata: `npm run test:db` copre ora entrambi i lati — il relatore che
la salva dal catalogo e il corsista che la legge nella revisione *anche
avendo sbagliato*, che è la metà facile da perdere per strada — più il caso
in cui la spiegazione non c'è e la revisione deve restare com'era prima.
Resta da cliccarla in produzione, ma non è più codice mai eseguito.

Fanno eccezione tre cose, scritte e verdi a test/lint/build ma **mai eseguite
con un database vero**:

- dalla pagina del corso il relatore può scrivere una lezione nuova sul posto,
  senza passare dal catalogo (resta comunque riusabile, e l'interfaccia lo
  dice);
- il pulsante «Traduci in inglese» nel catalogo (serve `ANTHROPIC_API_KEY`:
  finché non è impostata su Vercel, risponde che non è configurato);
- il codice di verifica dell'attestato, qui sotto — la parte che decide se un
  codice è autentico è però coperta da otto test che non richiedono database.

### L'attestato si può controllare

Un attestato stampato non dimostra niente da solo: chiunque sa aprire un PNG e
cambiarci il nome. Ora in fondo alla pergamena c'è un codice di sedici
caratteri e l'indirizzo dove si controlla — `/verifica/<codice>`, pagina
pubblica che non chiede di registrarsi (un controllo che richiede un account
non lo fa nessuno). Risponde con nome, corso, titolo di merito e data
dell'ultima consegna, letti dal server e non dal file.

**Non ha richiesto migrazioni, ed è la scelta portante:** il codice si *ricava*
dall'id dell'iscrizione invece di essere una colonna nuova — otto caratteri di
localizzatore, che servono solo a ritrovare la riga con l'indice della chiave
primaria, più quaranta bit di HMAC con una chiave derivata da
`UNLOCK_CODE_KEY`, che sono ciò che rende il codice non inventabile. Quindi
vale anche per gli attestati già scaricati, senza riempire niente a
posteriori. Il prezzo: **un singolo attestato non si può revocare**, perché non
c'è una riga da spegnere. Vedi `src/lib/verification.ts`; la parte che decide
è isolata in `codeMatches` ed è coperta da otto test che non richiedono un
database né una chiave nell'ambiente.

## Pronto ma non ancora in produzione

Sul ramo **`certificate-branding-ready`** (non `claude/dove-eravamo-rimasti-si1q8h`:
quel branch è stato riportato in pari con `main` dopo il revert, quindi in
cima non ha più questo lavoro — bisognava lasciarlo raggiungibile per nome,
non solo dentro la cronologia) c'è un corso di lavoro completo — luogo del
corso, firma testuale dell'attestato removibile, fino a quattro loghi di
partner che la sostituiscono — scritto, verificato nel disegno (screenshot
renderizzati a mano) e verificato a livello di schema contro un vero Postgres
(migrazione applicata, nessuna deriva rispetto a `schema.prisma`).

**Non è su `main`**: è stato unito e poi *tolto* con un revert non
distruttivo, perché portava un nuovo campo `Course.location`, un nuovo campo
`Course.certificateIssuer` e una nuova tabella `CourseLogo` che il database di
produzione non ha ancora — unirlo senza prima migrare avrebbe rotto ogni
pagina di corso in produzione. Il codice del ramo è integro e pronto; manca
solo l'ordine giusto:

1. `npx prisma migrate deploy` puntato al database di produzione (le due
   migrazioni si chiamano `20260808060000_course_location` e
   `20260808070000_certificate_branding`, e sono già scritte sul ramo);
2. **solo dopo**, portare `certificate-branding-ready` su `main` — un merge
   diretto basta, è stato staccato da lì.

Non ancora provato dal vivo nemmeno lì: il giro di caricamento di un logo
vero, perché da questo ambiente non si raggiunge lo store Vercel Blob.

## Le dispense: cosa protegge davvero, e cosa no

Richiesta del committente: i corsisti non devono poter condividere le
dispense, e «non devono poter fare screenshot».

**Gli screenshot non si possono impedire.** Nessun browser permette a una
pagina di bloccare la cattura dello schermo; ogni aggiramento (tasto destro
disabilitato, testo dentro un canvas, DRM) si scavalca in pochi minuti, e una
fotografia con il telefono batte qualunque difesa software. Chi promette il
contrario sta vendendo fumo. La strada presa è un'altra: **togliere
l'anonimato**, che è ciò che scoraggia davvero.

Cosa c'è oggi:

- nessun indirizzo pubblico: i file passano da una route che controlla
  sessione, iscrizione e sblocco **a ogni singola lettura**;
- ogni PDF esce **firmato con nome, email e data di chi lo apre**
  (`src/lib/watermark.ts`), in diagonale e ripetuto, più una riga leggibile in
  fondo. Una dispensa che gira dice da chi è passata;
- `Cache-Control: private, no-store`, così su un computer condiviso non resta
  copia su disco;
- `Content-Disposition: inline`: si apre nel browser invece di cadere nella
  cartella dei download.

Idea del committente da valutare (non ancora fatta): **niente scaricamento,
sola consultazione dentro l'area riservata**, con evidenziazioni e appunti
personali. È buona, e l'aggiunta degli appunti la rende perfino più comoda del
file scaricato — ma va detto che anche così i byte arrivano comunque al
browser per essere disegnati, quindi resta aggirabile da chi sa usare gli
strumenti per sviluppatori. Richiede un visualizzatore PDF interno (pdf.js) e
una tabella per le annotazioni: è un lavoro di giorni, non di ore.

Manca ancora, e conterebbe: un **registro delle letture** (chi ha aperto cosa
e quando). Oggi c'è solo `Material.viewCount`, un contatore che nessuna
schermata mostra e che non dice né chi né quando — inutile come traccia. Con
un registro, una dispensa che gira si risale a chi l'ha aperta.

## Cosa resta

1. **Provare il nuovo modo di aggiungere una serata**: crearne una, controllare
   che compaia in catalogo, e che un codice già usato nella stessa edizione dia
   errore senza lasciare in giro una lezione a metà.

2. **Resa su telefono e tablet: molto è stato corretto, resta il pezzo più
   grosso.** Fatti: il pulsante donazione non copre più il pulsante del quiz
   (si toccava quello sbagliato durante una prova a tempo), l'uscita non è più
   tagliata fuori dal riquadro sul telefono, l'editor domande non sfonda più
   sotto i 640px, timer e pulsante del quiz restano fissi in vista su schermi
   bassi, i bersagli da toccare (commutatore di lingua, pillole, comandi
   distruttivi) sono tutti almeno 40px, la dashboard passa a due colonne solo
   da `lg:`, e i titoli troncati vanno a capo su due righe invece di tagliarsi
   a metà parola. Restano:

   - **attestato su telefono**: l'SVG scala in proporzione, quindi a 360px le
     scritte minori vengono renderizzate a 3-6px, illeggibili. Alzare i corpi
     minimi nel disegno e far scorrere la pergamena su telefono invece di
     rimpicciolirla;
   - **tabella andamento classe**: scorre correttamente, ma la colonna del nome
     scorre via con le altre (renderla `sticky left-0`) e le intestazioni sono
     solo numeri con un `title` che sul touch non esiste — serve una legenda;
   - **contrasto**: il testo informativo a `text-cream/40`–`/45` sta sotto il
     rapporto 4,5:1, e alcune scritte sono a 9-11px. Per un pubblico adulto,
     in sala poco illuminata, conta.

3. **Un registro delle letture delle dispense** (vedi sezione sopra): oggi non
   si sa chi ha aperto cosa.

## Difetti trovati e non ancora corretti

Da tre revisioni approfondite. Ordinati per quanto costano davvero. Chi ne
corregge uno, tolga la voce.

### Punteggi e attestato — risolti

- **L'attestato non si prende più alla prima serata.** `certificateFor` ora
  richiede **tutte** le lezioni del corso, comprese quelle senza ancora
  domande — non solo quelle già scritte. Un corso a metà non produce più un
  attestato "di tutto il corso" dopo la prima sera.
- **Il punteggio non supera più 100, e le carte per lezione non sommano più
  più del totale.** Un tentativo chiuso resta scritto com'era alla consegna
  (`QuizAttempt.score`/`maxScore`, mai toccati: un tentativo deve restare
  coerente con se stesso) — ma quello che si MOSTRA nelle carte per lezione
  e nella tabella andamento classe è ora ricalcolato al budget di *oggi*,
  mantenendo la percentuale di allora (`rescaleToCurrentBudget`,
  `scoring.ts`). Chi ha fatto una lezione quando valeva 100 punti (era
  l'unica scritta) la vede oggi valere quanto vale ora — 14, se il corso è
  cresciuto a sei serate — non più 100. La somma delle carte non può quindi
  più superare il "Totale" mostrato accanto: sono la stessa cosa, non due
  calcoli indipendenti. `clampToCourseTotal` resta solo come rete contro un
  arrotondamento indipendente per lezione. Testato anche sul caso reale
  trovato (186/100).

Resta aperto:

- **Con molte lezioni, la maggior parte delle domande vale 0.** I 40 punti
  delle lezioni divisi per 12 serate lasciano 3-4 punti per serata da spartire
  fra 8 domande: 61 domande su 96 valgono zero. La somma resta 100, ma il
  corsista risponde a domande che non contano e non lo sa.
- **Un tentativo scaduto (`EXPIRED`) vale come "fatto" anche per
  l'attestato, senza soglia di punteggio.** Chi lascia scadere ogni quiz —
  scheda aperta fino a zero, o una sola visita successiva — riceve comunque
  l'attestato, con "Amico del Calice" e ogni lezione a 0 punti: non è mai
  bloccato dal non aver davvero risposto. Probabilmente voluto (l'alternativa
  sarebbe negare per sempre l'attestato a chi ha perso una serata), ma è una
  scelta di prodotto da confermare esplicitamente, non un effetto collaterale
  da correggere di nascosto.

### Quiz

- **Un tentativo scaduto resta "Riprendi".** Nessuno chiude i tentativi
  scaduti finché qualcuno non li tocca: la dashboard invita a riprendere, e
  premendo si viene sbalzati su un risultato consegnato che non si è mai
  consegnato, senza spiegazione.
- **L'ultima risposta può perdersi.** Il salvataggio della risposta non viene
  atteso prima di abilitare la consegna: toccando l'opzione e subito
  «Consegna», su rete lenta, la risposta giusta viene contata sbagliata.
- **Risolto: «Esci» non mentiva più quando il tempo era già scaduto.** Il
  pulsante prometteva "non verrà registrato nulla" e poi ignorava se
  l'abbandono fosse davvero riuscito; se il tempo era già scaduto nell'istante
  esatto del click, il server rifiutava (giustamente: altrimenti si riapriva
  il timer da capo, la falla corretta stanotte), ma il corsista tornava alla
  dashboard credendo di non aver lasciato traccia, mentre al tocco successivo
  quel tentativo si sarebbe chiuso da sé come scaduto. Ora l'esito si
  controlla, e in quel caso lo dice prima di uscire.

### Conflitti che diventano errori 500

Il database ferma sempre il dato sbagliato — quella parte è solida — ma
nessuna route traduce il conflitto in una risposta sensata: doppia iscrizione,
doppio avvio del quiz, doppio invio del codice giusto mostrano un errore
generico a chi in quel momento **è** riuscito. Serve un `catch` sul vincolo di
unicità che risponda "sei già iscritto" invece di "errore".

Fatto solo per la creazione di un corso: due richieste con lo stesso titolo
nello stesso istante potevano ricevere "codice già usato" quando la vera causa
era lo slug, non il codice — la route ora distingue le due cause guardando
quale vincolo ha protestato.

E il limite ai tentativi di indovinare i codici si conta prima di scrivere la
riga: venti richieste lanciate insieme passano tutte.

### Autorizzazioni (area relatore)

Le route del corsista sono solide — verificate una per una, nessuna si fida di
un id mandato dal client. Nell'area relatore invece alcune route ignorano
parte del proprio percorso: una modifica inviata con lo slug sbagliato cambia
un altro corso senza protestare. E **un corso rimesso in preparazione resta
usabile** da chi era già iscritto: sparisce dall'elenco ma quiz e dispense
continuano a funzionare.

### La promessa bilingue, che oggi è disattesa

Risolto in parte: **i campi inglesi del catalogo si riempiono da soli.** Nella
pagina di una lezione un pulsante «Traduci in inglese» manda il testo italiano
a `POST /api/admin/translate` e riempie i campi inglesi — domanda, opzioni e
spiegazione insieme (tradurre un'opzione senza la sua domanda perde il senso),
e a parte titolo e sottotitolo della lezione. Non traduce al salvataggio: quel
che torna resta modificabile, perché un testo che va davanti ai corsisti deve
poter passare da un occhio umano. Serve `ANTHROPIC_API_KEY`; senza, il
pulsante dice che non è configurato e il resto funziona.

Resta disatteso:

- **l'attestato è quasi tutto in italiano fisso** — il pezzo che il corsista si
  porta a casa non cambia premendo EN (il codice di verifica non ha lingua, ma
  tutto il resto sì);
- **tutta l'area relatore** è in italiano fisso, fuori da `src/lib/i18n.ts`;
- il titolo inglese di una dispensa non è scrivibile da nessun campo, quindi
  non c'è nemmeno niente da tradurre.

### Buchi nel pannello relatore

Risolto: **si può creare un corso dal pannello** (`POST /api/admin/courses`),
con slug derivato dal titolo e reso unico da solo. Nasce vuoto, in
preparazione: le lezioni si aggiungono dalla sua pagina.

Restano:

- **Non si possono cambiare titolo e sottotitolo di un corso**: il server li
  accetta, il modulo non li offre.
- **Non si può sbloccare una serata a un singolo corsista** che ha perso la
  lezione, benché il modello lo preveda (`UnlockMethod.ADMIN`, mai usato).
- **Non si possono caricare dispense generali del corso**: modello, vincolo e
  API ci sono, manca il pulsante.
- I punti per domanda sono calcolati e mandati al client, ma la pagina del
  risultato non li mostra mai.

### Resa responsive, ciò che resta

Attestato illeggibile su telefono (scritte a 3-6px, e la dicitura finale a 8px
perfino su computer); tabella dell'andamento classe che scorre bene ma perde
la colonna del nome e ha intestazioni numeriche con un `title` che sul touch
non esiste; testo informativo sotto il rapporto di contrasto 4,5:1; qualche
riga senza `flex-wrap`.

### Pulizia

`README.md` è ancora quello di `create-next-app`. Mancano i metadati per
l'anteprima dei link condivisi (il progetto invita a condividere l'attestato su
WhatsApp, e il link esce senza immagine). Restano funzioni esportate mai
chiamate, campi serializzati e mai letti, e `User.avatarUrl` scritto a ogni
accesso e mai usato.

### Test

`npm test` fallisce su una macchina appena clonata: 6 test su 43 chiedono
`UNLOCK_CODE_KEY`, che non ha né configurazione né file di setup. E le due
suite coprono solo le funzioni pure: nessun test tocca l'avvio, la consegna,
l'abbandono, lo sblocco o l'iscrizione — cioè esattamente i punti dove sono
stati trovati i difetti di sopra.
2. **Occasione aperta dal collegamento.** Il collegamento ha creato anche
   `BLOB_WEBHOOK_PUBLIC_KEY`, che prima non c'era. La firma dei caricamenti è
   scritta a mano proprio perché quella chiave mancava
   (`api/admin/materials/upload/route.ts`): ora si potrebbe usare
   `handleUploadPresigned` dell'SDK e togliere codice. Non urgente.
