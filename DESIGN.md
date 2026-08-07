# Riferimento visivo

Note prese dagli screenshot dell'app attuale (corso-vino-quiz.vercel.app),
da rispettare nella nuova versione. L'identità visiva è il tratto che piace
di più dell'attuale e va conservata, non reinventata (§6 del documento).

## Palette

Come da §6: fondo carbone, accenti oro, bordeaux di marca. Già in
`src/app/globals.css`.

## Tipografia

Negli screenshot dell'attuale: serif old-style dai contrasti marcati per
titoli, nomi e numeri di lezione (senza font da CDN, quindi è lo stack di
sistema — su Mac risulta *Iowan Old Style*/*Palatino*); sans geometrica per
il testo corrente, gli occhielli maiuscoletti e i pulsanti.

Nella nuova versione sono impostati **Cormorant Garamond** (serif) e **Jost**
(sans), impacchettati nel build da `next/font` — nessuna chiamata a un CDN a
pagina che si carica. Da confrontare a occhio con gli screenshot quando si
fa la passata di design: se Cormorant risulta troppo sottile rispetto
all'attuale, alzare il peso o valutare *EB Garamond*.

## Schermata di accesso

- Sigillo grande al centro, **riempito di bordeaux** con anello oro spesso e
  bordo dentellato — non un contorno sottile.
- Occhiello `L'ANGOLO DEL VINO` in oro, maiuscoletto spaziato, sopra il titolo.
- Titolo in serif grande, crema.
- Sottotitolo su due righe, crema smorzato.
- Pulsante `Accedi con Google`: pillola bianca, testo **sottolineato**, G a colori.
- Nota sotto: "Serve per salvare i tuoi progressi…".
- Pulsante donazione in basso a destra: **pillola oro piena con testo**
  "Offrimi un calice" + icona calice.

## Dashboard

Due colonne su desktop; a sinistra il profilo, a destra le lezioni.

### Colonna sinistra

- Occhiello `BENVENUTO/A`, poi nome in serif grande.
- Avatar circolare con iniziali, **anello oro**.
- Riga "Collegato come <email> · Esci dall'account".
- Card **Punti Totali riempita di bordeaux** (non scura come le altre): è
  l'elemento che spicca di più della pagina. Dentro: occhiello `PUNTI TOTALI`,
  anello di progresso con **un pallino oro sul tracciato**, numero grande,
  `/ 100` sotto, poi `QUALIFICA ATTUALE` e il titolo di merito.
  Quando il punteggio è 0 il testo è "Inizia il tuo percorso per scoprirla".
- Card **Sorso** con bordo oro: sigillo con calice, occhiello `SORSO`, titolo
  "Il taccuino di degustazione", descrizione, e pulsante `Apri Sorso →`
  a tutta larghezza.

### Colonna destra

- Intestazioni `LE TUE LEZIONI` e `Materiale Didattico →`.
- Griglia a 2 colonne di card lezione. Ogni card:
  - numero grande (`01`, `02`…) in un **cerchio con anello oro**, a sinistra;
  - occhiello `LEZIONE 1` in oro sopra il titolo;
  - titolo in serif, sottotitolo sotto;
  - pillola di stato a destra (`Inizia ›`, `🔒 Sblocca`, `✓ punti/max`).
- Bordi delle card in oro, più marcati di un semplice grigio.
- In fondo, centrato: `⚙ Area Relatore`.
- Pulsante donazione in basso a destra, **ridotto alla sola icona** del calice.

## Quiz

- In alto a sinistra `⎋ Esci`, in alto a destra `Tempo rimasto: 14:57`.
- Barra del tempo a tutta larghezza, gradiente oro (rossa sotto il 20%).
- Occhiello `LEZIONE 1 · DOMANDA 1 DI 8` in oro, con la sua barra di avanzamento.
- **La domanda sta in un riquadro color crema con bordo oro**: è l'unico
  elemento chiaro della pagina scura, e per questo si legge subito.
- Ogni opzione ha una **lettera in un cerchio** (A, B, C…) a sinistra.
- `Avanti` a tutta larghezza in fondo, spento finché non si sceglie.

## Area Relatore

- `← Torna alla Dashboard`, occhiello `AREA RELATORE`, titolo in serif.
- Sezioni con intestazioni in maiuscoletto oro spaziato:
  `ANTEPRIMA ATTESTATO`, `GESTISCI LEZIONI`, `TIMER QUIZ`,
  `GESTISCI MATERIALI`, `MODIFICA DOMANDE`.
- Ogni sezione ha un paragrafo grigio che spiega cosa fa e cosa comporta.
- **Gestisci lezioni**: righe con titolo e, sotto, la riga di calcolo punti
  (`8 domande · 8 punti (1 a domanda)`) — già prodotta da
  `describeLessonScoring` in `src/lib/scoring.ts`. A destra chevron di
  espansione e pulsante `🔒 Sblocca`. In fondo `+ Aggiungi lezione` e `Salva`.
- **Timer**: due campi numerici affiancati con etichetta, e `Salva durata`.
- **Materiali**: form con Titolo, select Lezione, `Tipo` come pillole
  selezionabili (Dispensa PDF / Slide / Immagine / Video / Pergamena),
  file, note, `Carica materiale`; sotto l'elenco dei caricati.
- **Modifica domande**: pillole-tab per lezione, poi accordion per domanda
  con radio sulla risposta corretta, campi di testo per le opzioni, `×` per
  eliminarle, `+ Aggiungi opzione`, `Elimina domanda` in rosso.

## Attestato

L'attuale (da migliorare, non da copiare): fondo pergamena crema, doppia
cornice oro con fregi agli angoli, sigillo bordeaux in alto con nastri
laterali, nastro bordeaux `ATTESTATO DI PARTECIPAZIONE`, nome del corso,
"Si attesta che", nome in corsivo bordeaux grande, separatore con rombo,
titolo di merito in bordeaux, sottotitolo in oro maiuscoletto, riga
`Punteggio finale: 96 / 100 · data`, e `L'ANGOLO DEL VINO` in fondo.

Il committente ha detto esplicitamente che **si può ridisegnare meglio**.
Vincoli da rispettare comunque: resta un attestato di *partecipazione*, mai
di qualifica professionale (§2.2), e va generato da **una sola sorgente**
(SVG) per schermo, PNG e stampa, invece delle tre versioni divergenti
dell'app attuale (§7.11).

## Pulsante donazione (§3.9)

Regola da rispettare ovunque:

- **Home / accesso**: pillola piena con testo ("Offrimi un calice").
- **Altre pagine**: solo l'icona del calice, cerchio oro.
- Su desktop si espande al passaggio del mouse; su touch resta com'è.
- Sempre presente, in ogni pagina.
