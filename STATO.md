# Stato del progetto

Documento di ripresa: chi arriva qui — persona o assistente, su qualsiasi
macchina o account — deve poter riprendere senza farsi raccontare niente.
Va aggiornato quando cambia lo stato, non a ogni commit.

**Dove vive:** repo [papalino93/nel-calice](https://github.com/papalino93/nel-calice)
(rinominato da `nuovo-corso-vino` — vedi "Nome e dominio" più giù) ·
produzione <https://nel-calice.vercel.app> · database Neon Postgres ·
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
- **Corso** (`Course`, `CourseLesson`, `CourseLogo`): l'edizione. `CourseLesson`
  è il collegamento, e porta ciò che è specifico di *quella* serata: numero,
  codice di sblocco, se è la prova finale. `CourseLogo` è deliberatamente
  separata da `Material`: un logo per l'attestato non è materiale didattico,
  non segue lo sblocco di una lezione, e mescolarlo alle dispense avrebbe
  confuso due cose che non si assomigliano.
- **Iscrizione** (`Enrollment`, `LessonUnlock`, `QuizAttempt`,
  `AttemptAnswer`, `MaterialView`): la storia del singolo corsista dentro una
  singola edizione.

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

Il pulsante «Traduci in inglese» non c'è più: provato prima con Anthropic
(a pagamento, escluso dal vincolo "mai un euro" del committente), poi con
MyMemory (gratuito, senza chiave), ma la qualità su contenuto vero è
risultata inaccettabile — vedi "La promessa bilingue" più giù. Nessuna
chiave di traduzione resta quindi da configurare, né `ANTHROPIC_API_KEY`
né altro.

Senza `UNLOCK_CODE_KEY` sei test falliscono: non è una regressione, è
l'ambiente incompleto.

## Ripartire su una macchina nuova

```bash
git clone https://github.com/papalino93/nel-calice && cd nel-calice
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

## Operare sul database di produzione da un ambiente senza TCP diretto

Da un ambiente cloud come questo, la connessione Postgres diretta (TCP,
porta 5432) verso Neon non è raggiungibile: solo l'HTTPS lo è. `src/lib/prisma.ts`
sa passare al driver HTTP/WebSocket di `@neondatabase/serverless`
(tunnelizzato sullo stesso `HTTPS_PROXY` di sistema) quando la variabile
`PRISMA_NEON_HTTP=1` è impostata. In produzione (Vercel) questa variabile
non c'è mai: il motore resta il TCP nativo di sempre, comportamento
invariato per l'app.

Per uno script una tantum contro produzione, da un ambiente così:

```bash
npx vercel login                              # un click di conferma
npx vercel link                                # collega la cartella al progetto
npx vercel env pull .env.production --environment production
set -a && source .env.production && set +a
export PRISMA_NEON_HTTP=1
npx tsx scripts/il-tuo-script.ts
```

**Importante:** spostare `.env.production`/`.env.local` fuori dalla cartella
del progetto subito dopo l'uso. `next build` li carica in automatico se li
trova nella working directory, e questo rompe la build (l'ha fatto una
volta, qui).

`scripts/import-questions.ts` è il primo di questi strumenti: importa
domande in blocco da un file JSON passando da `saveQuestion()`, la stessa
funzione validata del pannello — non scrive SQL a mano. Riusabile per la
prossima importazione di contenuti.

## Come va in produzione

Vercel distribuisce da sé a ogni push su `main`: non c'è nessun pulsante da
premere. Quindi «mandare in produzione» vuol dire unire su `main` e pushare, e
chi lavora qui **porta il lavoro fino in fondo** invece di fermarsi al proprio
ramo.

L'eccezione è una sola, ed è quella che conta: **se il lavoro porta una
migrazione, prima si migra il database di produzione e solo dopo si unisce.**
Nell'ordine inverso il codice nuovo arriva davanti a una colonna che non
esiste ancora, e ogni pagina che la tocca risponde 500 per tutto il tempo che
passa fra il deploy e la migrazione. Le migrazioni di spiegazione, firma
dell'attestato/loghi e registro delle letture sono state tutte lanciate in
quest'ordine apposta.

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

## Nome e dominio

Il progetto si chiamava `nuovo-corso-vino` — un nome tecnico, non un nome. Il
committente ha chiesto di cambiarlo con "qualcosa di caldo, bello", legato al
calice già disegnato nell'icona e nel pulsante donazioni ("Offrimi un
calice"): il nuovo nome è **Nel Calice**.

**"L'Angolo del Vino" nei testi dell'app non è il nome del progetto** — è
un'enoteca reale, un progetto separato, dove *questo* corso potrebbe
tenersi. Resta scritto dove già compariva (titolo, descrizione, firma
dell'attestato di default), volutamente non toccato: confonderlo col nome
del progetto sarebbe stato l'errore opposto.

Repository GitHub rinominato `nuovo-corso-vino` → `nel-calice` (redirect
automatico di GitHub dal vecchio indirizzo, quindi anche chi ha ancora il
link vecchio non trova un errore). Il progetto Vercel **non** è stato
rinominato apposta: rinominarlo avrebbe cambiato l'indirizzo di produzione
di scatto, rompendo la verifica di ogni attestato già scaricato (l'indirizzo
di controllo è scritto nel PNG, non aggiornabile a posteriori) e il login
finché non si fosse aggiornato anche Google Cloud Console. Invece:

- `nel-calice.vercel.app` è stato aggiunto come **dominio in più** sullo
  stesso progetto (`vercel domains add`, non il solo `vercel alias set` —
  quello da solo lascia il nuovo indirizzo dietro il login Vercel, non
  pubblico) — verificato dall'esterno, senza login, entrambi gli indirizzi
  rispondono 200 sullo stesso identico deploy.
- `nuovo-corso-vino.vercel.app` resta **intatto**, stesso progetto: chi ha
  già un attestato scaricato o un segnalibro continua a funzionare.
- `NEXT_PUBLIC_SITE_URL=https://nel-calice.vercel.app` impostata su Vercel
  (produzione): `src/lib/site.ts` la legge prima di ogni ripiego, quindi da
  ora ogni *nuovo* attestato porta il link di verifica col nome nuovo — i
  vecchi attestati continuano a puntare al vecchio, che è ancora vivo.
- Autorizzazione Google OAuth: **aggiunto** (non sostituito) l'URI di
  reindirizzamento per il nuovo indirizzo in Google Cloud Console — il
  login funziona su entrambi i domini, non solo sul nuovo.

Non fatto apposta: rinominare il progetto Vercel stesso (solo etichetta nel
pannello, nessun effetto su nessuno dei due indirizzi pubblici — non vale il
rischio per un dettaglio cosmetico).

## SEO e indicizzazione

Prima: un titolo fisso, nessuna descrizione per i motori di ricerca, nessuna
anteprima quando il link viene condiviso su WhatsApp o social (il link
usciva spoglio), nessuna `sitemap.xml` né `robots.txt`.

Aggiunto: metadati completi in `src/app/layout.tsx` (titolo con template,
descrizione, URL canonico), un'immagine di anteprima social generata via
`next/og` (`src/app/opengraph-image.tsx` — stessi colori e lo stesso
grappolo del sigillo dell'attestato, ridisegnato senza il filtro di texture
che quel renderer non sa disegnare), `robots.ts` (esclude `/relatore` e
`/api` dalla scansione — l'area relatore richiede login, indicizzarla non
avrebbe senso) e `sitemap.ts` (una sola voce, "/" — ogni altra pagina
richiede un accesso, quindi per un motore di ricerca sarebbe comunque solo
una schermata d'ingresso).

Verificato tutto avviando l'app per davvero (non solo a occhio sul codice):
letti i meta tag e l'immagine che il browser riceverebbe, entrambi corretti.

**Proprietà verificata su Google Search Console** (metodo file HTML,
`public/google6481f4a8f4f77cc3.html`), sitemap inviata, scansione richiesta
col Controllo URL — fatto dal committente dopo che il file era in
produzione e rispondeva stabile (un 404 iniziale era solo cache della CDN
non ancora aggiornata dopo il deploy, sparito da sé in pochi minuti).

**i-compiti e il-cerchio** (repository separati, stessa richiesta):
entrambi avevano `noindex, nofollow` scritto apposta — sono strumenti
pensati per essere usati solo tramite link condivisi in un gruppo WhatsApp
(nessun account, stato dentro l'URL). Il committente ha confermato di
volerli comunque indicizzabili ("chi vuole le può trovare, cade sulla
pagina d'ingresso e non nel gruppo di qualcun altro"): tolto il blocco,
aggiunti descrizione, anteprima social, `sitemap.xml`; `robots.txt` esclude
comunque le pagine con un compito specifico (`?t=<payload>`) dalla scansione
— quelle restano private per costruzione, solo la pagina d'ingresso è
pensata per essere trovata.

**sorso-taccuino**: reso pubblico su GitHub dal committente. Controllata
tutta la cronologia (28 commit): nessuna chiave, token o password mai
committata — `.env` sempre escluso, le credenziali (Google OAuth, Redis)
sono sempre state lette da variabili d'ambiente. La SEO qui era già
completa da prima (titolo, descrizione, canonical, Open Graph, Twitter
card, sitemap, robots.txt) — nessun intervento necessario.

## Cosa è fatto

Tutto provato dal vivo, non solo compilato: accesso con Google, iscrizione col
codice, sblocco della serata, quiz a tempo con correzione sul server, risultato
con revisione, attestato scaricabile in PNG, pannello relatore completo (corsi,
catalogo, domande, andamento della classe) e dispense con caricamento diretto e
accesso protetto.

**Il catalogo ha ora domande su tutte le lezioni.** Prima quattro delle sei
lezioni erano vuote (0 domande). Aggiunte 67 domande — con spiegazione e
traduzione inglese per ognuna — verificate una per una contro quelle già
esistenti per non duplicare lo stesso fatto due volte: Sensi 9, Bianchi e
Rosati 9, Grandi Rossi 8, Bollicine 10, Vini Dolci 8, Esame Finale 30 (vedi
`scripts/data/2026-08-10-catalogo.json`). Restano da scrivere le dispense
per le lezioni che non ne hanno.

**L'attestato è bilingue anche nel contenuto**, non solo nell'interfaccia
attorno: titolo del corso, titolo di merito e data cambiano davvero con il
commutatore IT/EN (prima restavano fissi in italiano). Il campo titolo
inglese delle dispense, previsto dal modello ma assente dal modulo di
caricamento, è stato aggiunto con lo stesso pulsante di traduzione già
usato per le domande.

**La spiegazione dopo la risposta è provata contro un Postgres vero**, non
solo compilata: `npm run test:db` copre ora entrambi i lati — il relatore che
la salva dal catalogo e il corsista che la legge nella revisione *anche
avendo sbagliato*, che è la metà facile da perdere per strada — più il caso
in cui la spiegazione non c'è e la revisione deve restare com'era prima.
Resta da cliccarla in produzione, ma non è più codice mai eseguito.

**Firma dell'attestato personalizzabile, luogo del corso e loghi di
partner.** `Course.location`, `Course.certificateIssuer` (removibile: se il
relatore lo svuota, quella riga sparisce dalla pergamena) e fino a quattro
`CourseLogo` che prendono il posto della firma testuale quando ci sono —
migrato in produzione e unito a `main`.

**Ogni riquadro ha una taglia, e può essere un testo invece di un'immagine.**
Il logo aveva una sola misura fissa, piccola per un'immagine pensata per
farsi notare (segnalato dal committente). `CourseLogo.url` è ora opzionale,
con `text` e `size` (S/M/L) accanto — un vincolo CHECK impedisce che un
riquadro sia entrambi o nessuno dei due, stesso schema di
`Material_exactly_one_owner`. La pagina del corso riunisce luogo, firma,
loghi e anteprima in un'unica sezione «Attestato» (prima sparsi, con
«Impostazioni del corso» in mezzo a loghi e anteprima), e l'anteprima ha un
pulsante «Aggiorna» esplicito — prima non si aggiornava da sola dopo un
cambio di logo. Migrato in produzione e unito a `main`. Non ancora provato
dal vivo: il caricamento di un'immagine vera e il salvataggio di un testo
dall'interfaccia (vedi Cosa resta) — da questo ambiente non si raggiunge lo
store Vercel Blob né un browser per cliccare il pannello.

**LARGE restava piccolo per un motivo diverso da quello corretto la prima
volta.** Il committente ha continuato a vederne alcuni piccoli anche dopo
l'aggiustamento di taglia. Causa reale: un riquadro largo quasi 3 volte la
sua altezza (170×60) — un'immagine ci si adatta mantenendo le proporzioni,
quindi un logo quadrato o verticale resta vincolato dall'altezza a 60px
comunque, qualunque taglia si scelga; solo un logo panoramico quanto il
riquadro ne usava davvero la larghezza. Verificato rendendo la pergamena
fuori dal browser (React a markup statico + Playwright) con un logo
quadrato, uno verticale e uno panoramico, prima e dopo. Corretto dando alla
fila dei loghi altezza vera in più (`CERTIFICATE_HEIGHT` da 700 a 760, tutta
dedicata a questo) e un rapporto larghezza/altezza del riquadro più vicino a
quello di un logo tipico (170×60 → 190×100, da quasi 3:1 a 2:1): LARGE passa
da 60 a 100px di altezza reale. Anche l'anteprima nel pannello relatore
aveva un difetto collegato — restava sempre alta 2.5rem indipendentemente
dalla taglia scelta, quindi cambiare S/M/L lì non si vedeva finché non si
guardava l'attestato vero — ora scala con la taglia. Non ancora cliccato
dal vivo con un file caricato per davvero (stesso limite di sopra: nessun
browser né store Blob raggiungibili da qui).

**Resa su telefono e tablet: quasi tutto quello che c'era da correggere è
corretto.** L'attestato non si rimpicciolisce più sotto i 720px (scorre in
orizzontale invece di rendere le scritte minori illeggibili, e le due righe
più piccole della pergamena sono passate da 10px a 12px); nella tabella
andamento classe la colonna del nome resta fissa allo scorrimento e una
legenda spiega le intestazioni numeriche, altrimenti senza senso al tocco; il
testo informativo a `text-cream/40`–`/45`, sotto il rapporto di contrasto
4,5:1 richiesto da WCAG AA, è ora a `/60` in tutto il sito. Il pulsante
donazione non copre più il pulsante del quiz, l'editor domande non sfonda più
sotto i 640px, i bersagli da toccare sono tutti almeno 40px. Resta solo
qualche riga senza `flex-wrap` (vedi Difetti trovati).

**C'è un registro di chi ha aperto quale dispensa e quando** (`MaterialView`,
migrato in produzione): prima c'era solo `Material.viewCount`, un contatore
che non diceva né chi né quando e che nessuna schermata mostrava. Si legge
nella sezione "Letture dispense" della pagina andamento classe.

**Le sezioni della pagina corso e della pagina lezione del catalogo si
richiudono.** Erano tutte sempre aperte insieme (Titoli, Attestato, Loghi,
Impostazioni, Lezioni da un lato; Titoli, Domande, Dispense dall'altro): la
pagina era un lungo muro di card, senza un modo per restringere lo sguardo
a una sola cosa. `AdminSection` (in `src/components/admin/AdminShell.tsx`)
è ora un `<details>`/`<summary>`: intestazione cliccabile con freccia che
ruota, contenuto che resta montato alla chiusura (nessuno stato perso),
nessuna libreria in più. Aperte di default solo le sezioni di lavoro
quotidiano — «Lezioni di questo corso» e «Domande» — le altre chiuse finché
non servono. Le altre pagine che usano `AdminSection` (andamento classe,
catalogo) non sono state toccate: continuano ad aprirsi come prima, non
erano nell'ambito di questo giro. Verificato in due modi, senza un login
Google da questo ambiente: rendendo il componente con la CSS reale del
build (React a markup statico), e scaricando il bundle JavaScript che
produzione serve davvero e cercandoci dentro l'esatto markup atteso
(freccia, classi, `defaultOpen` per sezione) — è il codice giusto quello
che gira, confermato, ma cliccarci sopra in un browser vero da relatore
autenticato resta da fare (committente confermato che le sezioni si aprono
e chiudono, provando dal vivo).

**I loghi sono davvero grandi ora, in ogni forma.** Il primo fix (§ sopra)
copriva solo il logo quadrato o verticale, vincolato dall'altezza. Un
logotipo largo e basso — "vino.com", segnalato dal committente vedendo il
proprio attestato — resta vincolato dalla LARGHEZZA anche con l'altezza
corretta, se il riquadro non gliene lascia abbastanza. `LOGO_BOX` in
`src/components/Certificate.tsx` è ora molto più largo (fino a 320px per
LARGE, da 190), e `LogoRow` restringe l'intera fila in proporzione se la
somma dei riquadri supera lo spazio della pergamena — mai un logo isolato
più piccolo degli altri, mai una fila che esce dal foglio. Verificato
rendendo la pergamena con un logotipo 4:1 (singolo, doppio, quattro insieme
come stress test).

**Fino a 3 loghi e un testo insieme: già possibile, non serviva altro.**
Segnalato dal committente come mancante, ma il limite di 4 riquadri
(`MAX_COURSE_LOGOS`) non distingue immagine da testo: 3 immagini più un
testo sono già 4 riquadri validi. Verificato rendendo la pergamena con
esattamente questa combinazione — nessuna modifica necessaria.

**Il luogo non compariva nell'anteprima dell'attestato, con o senza
loghi.** `sampleCertificate` lo azzerava a mano ("nell'anteprima non c'è
un corso reale da cui prenderlo") mentre la route che la chiama legge già
un corso vero per titolo, firma e loghi — il luogo era l'unico rimasto
fuori dalla lettura, probabilmente dimenticato quando l'anteprima ha
smesso di essere del tutto finta. L'attestato vero non aveva questo
problema. Corretto passando il luogo vero fino in fondo; verificato
rendendo la pergamena con luogo e loghi insieme.

**"Scarica la pergamena" non scaricava nulla da telefono** (segnalato
provando da iPhone, Chrome — che su iOS è comunque il motore di Safari,
Apple lo impone a ogni browser): l'attributo `download` su un blob non è
affidabile su WebKit iOS. Ora si prova prima `navigator.share` con il file
vero quando il telefono lo supporta (foglio di condivisione nativo, con
"Salva immagine" già fra le opzioni), col download via link come ripiego
per desktop. Lo stesso foglio risolve anche **l'invio via WhatsApp col
file vero**: prima "Condividi su WhatsApp" apriva solo un messaggio di
testo, senza modo di allegare la pergamena; ora la allega quando il
telefono lo supporta, e resta il link di solo testo altrove. Non ancora
provato dal vivo che il foglio di condivisione si apra davvero (da questo
ambiente non c'è un telefono reale) — il committente lo confermerà stasera.

**C'è una dashboard in diretta per una lezione mentre la classe risponde.**
Richiesta del committente: seguire in tempo reale chi ha aperto il quiz, a
che punto è, quante risposte sono giuste finora. Nuova pagina
`/relatore/corso/[slug]/lezione/[clId]` (link "Diretta" su ogni lezione del
corso), che fa polling ogni 4 secondi: per iscritto, stato del tentativo
(non iniziato/in corso/consegnato/scaduto), risposte date, corrette finora,
tempo residuo; per domanda, corrette/sbagliate/in bianco sull'intera
classe. Il punto delicato: `AttemptAnswer.isCorrect` lo scrive il server
solo alla consegna, quindi durante un tentativo IN_PROGRESS resta al suo
valore di default — la funzione (`liveLessonOverview` in `src/lib/admin.ts`)
calcola la correttezza al volo confrontando `selectedOptionId` con
l'opzione giusta, una lettura sola, mai vista dal corsista. Verificato
contro un Postgres vero (produzione, di sola lettura): il conteggio
calcolato al volo per una lezione già consegnata corrisponde esattamente,
domanda per domanda, a quanto il server aveva già scritto a suo tempo in
`isCorrect`; una lezione senza tentativi non va in errore; uno slug
sbagliato risponde "non trovato" invece di mostrare la lezione di un altro
corso. Non ancora vista durante un quiz davvero in corso — non ce n'era
uno mentre veniva scritta.

**Il conto alla rovescia durante il quiz esisteva già** (segnalato come
mancante, ma c'era: `src/app/corso/[slug]/lezione/[clId]/quiz/page.tsx`,
barra che cambia colore sotto il 20% del tempo, consegna automatica allo
scadere). L'unica cosa toccata: l'etichetta "Durata lezioni" nel pannello
del corso, che diceva "lezioni" mentre il campo è sempre stato la durata
del *quiz* — non della serata — ora "Durata del quiz di lezione".

Fanno eccezione due cose, scritte e verdi a test/lint/build ma **mai eseguite
con un database vero**:

- dalla pagina del corso il relatore può scrivere una lezione nuova sul posto,
  senza passare dal catalogo (resta comunque riusabile, e l'interfaccia lo
  dice);
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

**Risolto: c'è un registro delle letture.** L'entità `MaterialView` (una riga
per apertura, non un contatore) registra chi ha aperto quale dispensa e
quando, con cascata sia sulla dispensa che sull'iscrizione. Si scrive in
parallelo a `Material.viewCount` (che resta, ma è ormai solo un residuo — vedi
Pulizia) nella stessa route che serve il file, e si legge nella nuova sezione
"Letture dispense" della pagina andamento classe del relatore, più recenti in
cima. Una dispensa che gira ora si risale a chi l'ha aperta.

## Cosa resta

1. **Provare il nuovo modo di aggiungere una serata**: crearne una, controllare
   che compaia in catalogo, e che un codice già usato nella stessa edizione dia
   errore senza lasciare in giro una lezione a metà.

2. **Il pannello «Attestato» non è ancora stato cliccato dal vivo**: caricare
   un'immagine vera, aggiungere un testo al posto di un logo, cambiare la
   taglia di un riquadro e vedere l'anteprima aggiornarsi col pulsante
   «Aggiorna». Il codice è in produzione e verificato a livello di schema
   (vincolo CHECK e cascata compresi, contro un Postgres sandbox), ma da
   questo ambiente non si raggiunge lo store Vercel Blob né un browser per
   provare l'interfaccia.

3. **Il foglio di condivisione nativo (scarica/WhatsApp) non è stato
   toccato con un telefono vero**: verificato che il codice giusto sia in
   produzione (bundle controllato), ma non che `navigator.share` si apra
   davvero e che "Salva immagine" funzioni — serve un telefono, che da qui
   non c'è.

4. **La dashboard «Diretta» di una lezione non è ancora stata vista durante
   un quiz vero**: la correttezza calcolata al volo è verificata contro dati
   reali già consegnati (corrisponde esattamente a quanto il server aveva
   scritto), ma nessuno l'ha ancora guardata mentre qualcuno rispondeva
   davvero — non c'era un quiz in corso al momento di scriverla.

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
doppio avvio del quiz, doppio invio del codice giusto, due domande create nello
stesso istante nella stessa lezione mostrano un errore generico a chi in quel
momento **è** riuscito. Serve un `catch` sul vincolo di unicità che risponda
"sei già iscritto" invece di "errore".

Fatto solo per la creazione di un corso: due richieste con lo stesso titolo
nello stesso istante potevano ricevere "codice già usato" quando la vera causa
era lo slug, non il codice — la route ora distingue le due cause guardando
quale vincolo ha protestato.

E il limite ai tentativi di indovinare i codici si conta prima di scrivere la
riga: venti richieste lanciate insieme passano tutte. Vale anche per
l'iscrizione: la via con lo slug del corso (`/api/courses/[slug]/enroll`) ha un
budget di tentativi **indipendente** da quella senza (`/api/enroll`) — chi
tira a indovinare ha convenienza a passare dalla prima.

### Autorizzazioni (area relatore)

Le route del corsista sono solide — verificate una per una, nessuna si fida di
un id mandato dal client. Nell'area relatore invece alcune route ignorano
parte del proprio percorso: una modifica inviata con lo slug sbagliato cambia
un altro corso senza protestare. E **un corso rimesso in preparazione resta
usabile** da chi era già iscritto: sparisce dall'elenco ma quiz e dispense
continuano a funzionare.

### La promessa bilingue, che oggi è disattesa

**Il pulsante «Traduci in inglese» è stato provato e poi tolto.** L'idea era
riempire da soli i campi inglesi del catalogo (domanda, opzioni, spiegazione,
titoli di corso e lezione, titolo di una dispensa) mandando l'italiano a un
servizio di traduzione. Con Anthropic funzionava bene ma costava (pochi
centesimi al mese, comunque in contrasto col vincolo esplicito "mai un
euro"); passato a MyMemory (gratuito, senza chiave — §7.20) per rispettare
quel vincolo, ma la qualità sul contenuto vero del catalogo è risultata
troppo grezza per essere utile — segnalato dal committente dopo averlo
provato. Tolto ovunque: i campi inglesi restano scrivibili solo a mano,
come prima che questo pulsante esistesse. `TranslateRow`, `useTranslator` e
`/api/admin/translate` sono stati rimossi, non c'era altro uso rimasto.

Risolto e rimasto: **l'attestato cambia davvero lingua.** Titolo del corso,
titolo di merito, sottotitolo e data arrivano in coppia IT/En
(`certificateFor`/`sampleCertificate`), e il componente `Certificate`
sceglie anche le parole fisse della cornice in base alla lingua corrente.
Il codice di verifica resta senza lingua per scelta: è un indirizzo, non un
testo. La pagina pubblica `/verifica/<codice>`, invece, resta
deliberatamente in italiano fisso (decisione di chi l'ha scritta, invariata).

Resta disatteso:

- **i campi inglesi del catalogo vanno scritti a mano**, di nuovo — senza un
  servizio di traduzione gratuito di qualità accettabile, e senza budget per
  uno a pagamento, non c'è scorciatoia onesta.
- **tutta l'area relatore** è in italiano fisso, fuori da `src/lib/i18n.ts` —
  scelta deliberata per ora: la usa solo il relatore, che è di madrelingua
  italiana, quindi il valore pratico di tradurla è basso.

### Buchi nel pannello relatore

Risolto: **si può creare un corso dal pannello** (`POST /api/admin/courses`),
con slug derivato dal titolo e reso unico da solo. Nasce vuoto, in
preparazione: le lezioni si aggiungono dalla sua pagina.

Restano:

- **Non si può sbloccare una serata a un singolo corsista** che ha perso la
  lezione, benché il modello lo preveda (`UnlockMethod.ADMIN`, mai usato).
- **Non si possono caricare dispense generali del corso**: modello, vincolo e
  API ci sono, manca il pulsante.
- I punti per domanda sono calcolati e mandati al client, ma la pagina del
  risultato non li mostra mai.
- **Alcune route admin ignorano parte del proprio percorso**: una PATCH su una
  lezione o una domanda inviata con lo slug/lessonId sbagliato tocca comunque
  la riga giusta per id, senza controllare che appartenga a quel corso/lezione.
  Non è una scalata di privilegi (il relatore può già tutto), ma un id
  scambiato per errore scrive nel posto sbagliato senza protestare. Le nuove
  route dei loghi (sotto) e l'azzeramento tentativo sono già al riparo da
  questo difetto: verificano lo slug ad ogni chiamata.

### Resa responsive — risolto quasi tutto

Vedi "Cosa è fatto": attestato, tabella andamento classe e contrasto sono
risolti. Resta solo qualche riga senza `flex-wrap` — minore, non ancora
localizzata riga per riga.

### Pulizia

`README.md` è ancora quello di `create-next-app`. Mancano i metadati per
l'anteprima dei link condivisi (il progetto invita a condividere l'attestato su
WhatsApp, e il link esce senza immagine). Restano funzioni esportate mai
chiamate, campi serializzati e mai letti, e `User.avatarUrl` scritto a ogni
accesso e mai usato. `Material.viewCount` è ridondante rispetto a
`MaterialView` (vedi sopra), ma toglierlo tocca anche l'interfaccia che lo
mostra: non fatto in questo giro.

Il collegamento allo store Blob ha creato anche `BLOB_WEBHOOK_PUBLIC_KEY`, che
prima non c'era. La firma dei caricamenti è scritta a mano proprio perché
quella chiave mancava (`api/admin/materials/upload/route.ts`): ora si
potrebbe usare `handleUploadPresigned` dell'SDK e togliere codice. Non
urgente.

### Test

`npm test` fallisce su una macchina appena clonata: 6 test su 58 chiedono
`UNLOCK_CODE_KEY`, che non ha né configurazione né file di setup. E le
suite coprono solo le funzioni pure: nessun test unitario tocca l'avvio, la
consegna, l'abbandono, lo sblocco o l'iscrizione — cioè esattamente i punti
dove sono stati trovati i difetti di sopra (`npm run test:db`, che li tocca,
serve solo un Postgres vero — vedi sopra).
