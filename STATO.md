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

Fa eccezione una cosa, scritta ma **mai provata dal vivo**: dalla pagina del
corso il relatore può ora scrivere una lezione nuova sul posto, senza passare
dal catalogo (resta comunque riusabile, e l'interfaccia lo dice). Test, lint e
build sono verdi, ma nessuno l'ha ancora cliccata con un database vero.

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

2. **Resa su telefono e tablet: corretti i due difetti gravi, ne restano.**
   Fatti: il pulsante donazione non copre più il pulsante del quiz (si toccava
   quello sbagliato durante una prova a tempo), e l'uscita non è più tagliata
   fuori dal riquadro sul telefono. Restano, in ordine di peso:

   - **editor domande, riga delle opzioni** (`relatore/catalogo/[lessonId]`,
     ~riga 391): due campi di testo affiancati senza `flex-wrap` sfondano sotto
     i 640px — l'unico punto dell'app che scorre in orizzontale. Impilarli con
     `flex-col sm:flex-row` e `min-w-0`;
   - **attestato su telefono**: l'SVG scala in proporzione, quindi a 360px le
     scritte minori vengono renderizzate a 3-6px, illeggibili; anche a 1280px
     la dicitura finale è a 8px. Alzare i corpi minimi nel disegno e far
     scorrere la pergamena su telefono invece di rimpicciolirla;
   - **quiz su schermi bassi**: con 5-6 opzioni il pulsante primario finisce
     sotto la piega e il timer scorre via in cima. Renderli fissi (`sticky`);
   - **bersagli da toccare sotto i 40px**: il commutatore di lingua (24px, su
     *ogni* pagina), le pillole, le caselle di spunta a 16px, e i comandi
     distruttivi «Elimina»/«Togli dal corso» a 18px;
   - **tabella andamento classe**: scorre correttamente, ma la colonna del nome
     scorre via con le altre (renderla `sticky left-0`) e le intestazioni sono
     solo numeri con un `title` che sul touch non esiste — serve una legenda;
   - **dashboard su tablet**: passa a due colonne già a 768px e la colonna
     sinistra resta una strisciolina; portare a `lg:`;
   - **contrasto**: il testo informativo a `text-cream/40`–`/45` sta sotto il
     rapporto 4,5:1, e alcune scritte sono a 9-11px. Per un pubblico adulto,
     in sala poco illuminata, conta.

3. **Un registro delle letture delle dispense** (vedi sezione sopra): oggi non
   si sa chi ha aperto cosa.

## Difetti trovati e non ancora corretti

Da tre revisioni approfondite. Ordinati per quanto costano davvero. Chi ne
corregge uno, tolga la voce.

### Punteggi e attestato — i due che mordono di più

- **L'attestato si può prendere alla prima serata.** `certificate.ts:35-40`
  considera "da fare" solo le lezioni che *in questo momento* hanno domande.
  Corso di sei serate con le domande scritte solo per la prima: chi la fa
  risulta averle fatte tutte, prende 100/100 e "Palato d'Oro". Da decidere: il
  conto guarda le lezioni **presenti** nel corso o solo quelle già scritte?
- **Il punteggio può superare 100.** I budget si ricalcolano sulla forma
  attuale del corso, ma il punteggio di un tentativo resta quello di allora, e
  nessuno riconcilia le due cose. Chi fa la lezione 1 quando è l'unica scritta
  prende 100; scritte le altre, il totale può arrivare a 186 su 100 —
  sull'anello di progresso e sull'attestato. Serve decidere se rinormalizzare
  i punteggi storici o congelare i budget alla consegna.
- **Con molte lezioni, la maggior parte delle domande vale 0.** I 40 punti
  delle lezioni divisi per 12 serate lasciano 3-4 punti per serata da spartire
  fra 8 domande: 61 domande su 96 valgono zero. La somma resta 100, ma il
  corsista risponde a domande che non contano e non lo sa.

### Quiz

- **Un tentativo scaduto resta "Riprendi".** Nessuno chiude i tentativi
  scaduti finché qualcuno non li tocca: la dashboard invita a riprendere, e
  premendo si viene sbalzati su un risultato consegnato che non si è mai
  consegnato, senza spiegazione.
- **L'ultima risposta può perdersi.** Il salvataggio della risposta non viene
  atteso prima di abilitare la consegna: toccando l'opzione e subito
  «Consegna», su rete lenta, la risposta giusta viene contata sbagliata.

### Conflitti che diventano errori 500

Il database ferma sempre il dato sbagliato — quella parte è solida — ma
nessuna route traduce il conflitto in una risposta sensata: doppia iscrizione,
doppio avvio del quiz, doppio invio del codice giusto mostrano un errore
generico a chi in quel momento **è** riuscito. Serve un `catch` sul vincolo di
unicità che risponda "sei già iscritto" invece di "errore".

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

C'è l'interruttore IT/EN su ogni pagina, ma:

- **l'attestato è tutto in italiano fisso** — il pezzo che il corsista si porta
  a casa non cambia una parola premendo EN;
- **tutta l'area relatore** è in italiano fisso, fuori da `src/lib/i18n.ts`;
- il titolo inglese di una dispensa non è scrivibile da nessun campo.

### Buchi nel pannello relatore

- **Non si può creare un corso**: non esiste nessun `POST /api/admin/courses`.
  I corsi nascono solo dal seed. Alla seconda edizione ci si blocca.
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
