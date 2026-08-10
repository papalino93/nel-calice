// Attestato di partecipazione.
//
// **Una sola sorgente.** Questo SVG è l'unico disegno che esiste: la pagina
// lo mostra così com'è, il download lo converte in PNG, la stampa stampa lo
// stesso nodo. Nell'app attuale l'attestato è disegnato tre volte — HTML,
// canvas e stampa — con codice duplicato da tenere allineato a mano, ed è
// il difetto §7.11.
//
// Da qui discende una scelta tipografica: il font è uno stack di sistema e
// non il Cormorant del resto dell'app. Un font caricato dal browser non
// arriva dentro il canvas quando l'SVG viene convertito in immagine, e il
// PNG uscirebbe con un carattere diverso da quello a schermo. Meglio un
// serif presente ovunque, uguale in tutti e tre i casi, che un carattere
// più bello che si rompe proprio nella copia che l'utente conserva.
//
// Vincolo di contenuto (§2.2): è un attestato di *partecipazione* a un corso
// amatoriale. Niente che suggerisca una qualifica professionale.

import type { Language } from "@/lib/i18n";
import { GrapesEmblem } from "./icons";

export const CERTIFICATE_WIDTH = 1000;
export const CERTIFICATE_HEIGHT = 700;

/** Le uniche parole della pergamena che non arrivano dal server come dato:
 * la cornice del documento, non il suo contenuto. */
const STRINGS = {
  it: {
    ariaLabel: (name: string) => `Attestato di partecipazione per ${name}`,
    banner: "ATTESTATO DI PARTECIPAZIONE",
    attestsThat: "Si attesta che",
    earnedTitle: "ha partecipato al corso, meritandosi il titolo di",
    disclaimer: "Corso amatoriale · non costituisce qualifica professionale",
    verify: "Verifica",
  },
  en: {
    ariaLabel: (name: string) => `Certificate of participation for ${name}`,
    banner: "CERTIFICATE OF PARTICIPATION",
    attestsThat: "This certifies that",
    earnedTitle: "took part in the course, earning the title of",
    disclaimer:
      "Amateur course · does not constitute a professional qualification",
    verify: "Verify",
  },
} as const;

const SERIF =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const GOLD = "#D4AF37";
const GOLD_DEEP = "#A9822A";
const GOLD_LIGHT = "#E9CE7E";
const BORDEAUX = "#722F37";
const BORDEAUX_DEEP = "#48181D";
const CREAM = "#F6F0E5";
const INK = "#3A3128";

export type CertificateData = {
  name: string;
  courseTitleIt: string;
  courseTitleEn: string;
  meritTitleIt: string;
  meritTitleEn: string;
  meritSubtitleIt: string;
  meritSubtitleEn: string;
  /** Città del corso. Facoltativa: se manca, si mostra solo la data. */
  location: string | null;
  dateIt: string;
  dateEn: string;
  /** Firma testuale. Facoltativa: vuota, quella riga sparisce. */
  issuer: string | null;
  /**
   * Loghi già pronti come `data:` URI (mai un indirizzo esterno: vedi
   * src/lib/certificate.ts per il perché). Quando presenti prendono il posto
   * della firma testuale invece di affiancarla — un'edizione realizzata con
   * un partner non deve portare né il nome dell'organizzatore né i suoi
   * marchi ambiguamente insieme, uno dei due.
   */
  logos: string[];
  /**
   * Codice di verifica già formattato, e l'indirizzo dove si controlla.
   * Facoltativi: l'anteprima del relatore non ne ha uno vero, e senza di
   * essi la pergamena è esattamente com'era prima.
   */
  verificationCode?: string;
  verificationHost?: string;
};

/** Sigillo dentellato, lo stesso dell'app ma ridisegnato in coordinate SVG. */
function sealPoints(cx: number, cy: number, outer: number, inner: number) {
  const teeth = 40;
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** Fregio ad angolo: due segmenti e un rombo, ripetuto ai quattro angoli. */
function CornerOrnament({
  x,
  y,
  flipX,
  flipY,
}: {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
      <path
        d="M0 26 L0 6 Q0 0 6 0 L26 0"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1.6"
      />
      <path d="M8 8 l5 -5 5 5 -5 5 z" fill={GOLD} />
    </g>
  );
}

/** Tralcio di vite stilizzato, ai lati del sigillo. */
function Vine({ x, y, mirrored }: { x: number; y: number; mirrored: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${mirrored ? -1 : 1} 1)`}>
      <path
        d="M0 0 C 20 -8, 42 -6, 60 2"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="-2" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="27" cy="-5" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="36" cy="-3" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="24" cy="3" r="3.2" fill={BORDEAUX} opacity="0.6" />
      <circle cx="33" cy="4" r="3.2" fill={BORDEAUX} opacity="0.6" />
    </g>
  );
}

/**
 * Fila di loghi centrata. Ogni immagine sta dentro una gabbia di dimensione
 * fissa e vi si adatta mantenendo le proporzioni (comportamento di default
 * di `<image>`), così un logo quadrato e uno molto largo non vengono
 * deformati né sbilanciano la riga.
 */
function LogoRow({
  cx,
  y,
  logos,
}: {
  cx: number;
  y: number;
  logos: string[];
}) {
  const boxWidth = 88;
  const boxHeight = 30;
  const gap = 14;
  const totalWidth = logos.length * boxWidth + (logos.length - 1) * gap;
  const startX = cx - totalWidth / 2;

  return (
    <g>
      {logos.map((href, i) => (
        <image
          key={i}
          href={href}
          x={startX + i * (boxWidth + gap)}
          y={y}
          width={boxWidth}
          height={boxHeight}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
    </g>
  );
}

export function Certificate({
  data,
  lang = "it",
  id = "attestato",
}: {
  data: CertificateData;
  lang?: Language;
  id?: string;
}) {
  const cx = CERTIFICATE_WIDTH / 2;
  const s = STRINGS[lang];
  const courseTitle = lang === "en" ? data.courseTitleEn : data.courseTitleIt;
  const meritTitle = lang === "en" ? data.meritTitleEn : data.meritTitleIt;
  const meritSubtitle =
    lang === "en" ? data.meritSubtitleEn : data.meritSubtitleIt;
  const date = lang === "en" ? data.dateEn : data.dateIt;

  return (
    <svg
      id={id}
      viewBox={`0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={s.ariaLabel(data.name)}
      // Larghezza minima, non solo massima: sotto questa soglia le scritte
      // più piccole diventano illeggibili (§ resa responsive). Sotto i
      // 720px il contenitore in CertificateView scorre in orizzontale
      // invece di continuare a rimpicciolire.
      className="h-auto w-full min-w-[720px] print:min-w-0"
      style={{ display: "block" }}
    >
      <defs>
        {/* Carta invecchiata: una texture leggera, non un effetto vistoso. */}
        <filter id={`${id}-paper`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="saturate"
            values="0"
            result="mono"
          />
          <feComponentTransfer in="mono" result="soft">
            <feFuncA type="linear" slope="0.05" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="soft" mode="multiply" />
        </filter>

        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="45%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>

      {/* Pergamena */}
      <rect width="100%" height="100%" fill={CREAM} />
      <rect
        width="100%"
        height="100%"
        fill={CREAM}
        filter={`url(#${id}-paper)`}
      />

      {/* Filigrana: un calice appena accennato, dietro il testo */}
      <g opacity="0.05" transform={`translate(${cx - 110} 180) scale(9)`}>
        <path
          d="M7 3h10v4c0 2.8-2.2 5-5 5s-5-2.2-5-5z M12 12v7 M8.5 19.5h7"
          fill="none"
          stroke={BORDEAUX}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>

      {/* Cornice doppia */}
      <rect
        x="26"
        y="26"
        width={CERTIFICATE_WIDTH - 52}
        height={CERTIFICATE_HEIGHT - 52}
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="3"
        rx="4"
      />
      <rect
        x="40"
        y="40"
        width={CERTIFICATE_WIDTH - 80}
        height={CERTIFICATE_HEIGHT - 80}
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1"
        strokeDasharray="1 5"
        strokeLinecap="round"
        rx="2"
      />

      <CornerOrnament x={54} y={54} flipX={false} flipY={false} />
      <CornerOrnament
        x={CERTIFICATE_WIDTH - 54}
        y={54}
        flipX
        flipY={false}
      />
      <CornerOrnament
        x={54}
        y={CERTIFICATE_HEIGHT - 54}
        flipX={false}
        flipY
      />
      <CornerOrnament
        x={CERTIFICATE_WIDTH - 54}
        y={CERTIFICATE_HEIGHT - 54}
        flipX
        flipY
      />

      {/* Sigillo con tralci */}
      <Vine x={cx - 62} y={112} mirrored />
      <Vine x={cx + 62} y={112} mirrored={false} />

      <g>
        <polygon
          points={sealPoints(cx, 112, 46, 41)}
          fill={`url(#${id}-gold)`}
        />
        <circle cx={cx} cy={112} r="41" fill={`url(#${id}-gold)`} />
        <circle cx={cx} cy={112} r="32" fill={BORDEAUX_DEEP} />
        <circle
          cx={cx}
          cy={112}
          r="32"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.8"
          opacity="0.5"
        />
        {/* Grappolo: sull'attestato al posto del calice, che è già l'icona
            di tutto il resto dell'app. Così la pergamena ha un emblema suo. */}
        <g transform={`translate(${cx - 24} ${112 - 26}) scale(1.05)`}>
          <GrapesEmblem accent={GOLD_LIGHT} />
        </g>
      </g>

      {/* Nastro */}
      <g transform={`translate(${cx} 200)`}>
        <path
          d="M-190 -17 L190 -17 L172 0 L190 17 L-190 17 L-172 0 Z"
          fill={BORDEAUX}
        />
        <text
          x="0"
          y="5"
          textAnchor="middle"
          fill={CREAM}
          fontFamily={SANS}
          fontSize="14"
          letterSpacing="4.5"
        >
          {s.banner}
        </text>
      </g>

      {/* Corso */}
      <text
        x={cx}
        y="258"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="21"
      >
        {courseTitle}
      </text>

      <text
        x={cx}
        y="303"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="17"
        opacity="0.62"
      >
        {s.attestsThat}
      </text>

      {/* Il nome: l'elemento più grande della pergamena */}
      <text
        x={cx}
        y="372"
        textAnchor="middle"
        fill={BORDEAUX}
        fontFamily={SERIF}
        fontSize="56"
        fontStyle="italic"
      >
        {data.name}
      </text>

      <text
        x={cx}
        y="410"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="17"
        opacity="0.62"
      >
        {s.earnedTitle}
      </text>

      {/* Separatore con rombo */}
      <g transform={`translate(${cx} 436)`}>
        <line x1="-120" y1="0" x2="-14" y2="0" stroke={GOLD} strokeWidth="1" />
        <path d="M0 -6 l6 6 -6 6 -6 -6 z" fill={GOLD} />
        <line x1="14" y1="0" x2="120" y2="0" stroke={GOLD} strokeWidth="1" />
      </g>

      {/* Titolo di merito — informale e giocoso (§2.2) */}
      <text
        x={cx}
        y="492"
        textAnchor="middle"
        fill={BORDEAUX}
        fontFamily={SERIF}
        fontSize="38"
        fontWeight="bold"
      >
        {meritTitle}
      </text>

      <text
        x={cx}
        y="521"
        textAnchor="middle"
        fill={GOLD_DEEP}
        fontFamily={SANS}
        fontSize="12"
        letterSpacing="2.6"
      >
        {meritSubtitle.toUpperCase()}
      </text>

      {/* Chiusura in stile «Roma, 8 agosto 2026» — la convenzione con cui si
          firma una lettera, non una riga di dati. Niente più punteggio: il
          titolo di merito già dice come è andata, in una forma che non mette
          mai in imbarazzo (un "26/100" lo farebbe, un "Amico del Calice" no).
          Il luogo è facoltativo: se il corso non lo specifica, resta solo
          la data, com'era prima che questo campo esistesse. */}
      <text
        x={cx}
        y="574"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontStyle="italic"
        fontSize="16"
        opacity="0.85"
      >
        {data.location ? `${data.location}, ${date}` : date}
      </text>

      {/* I loghi, quando ci sono, prendono il posto della firma testuale
          invece di affiancarla: è il caso di un'edizione realizzata con un
          partner, dove non deve comparire il nome dell'organizzatore ma i
          marchi di chi la fa insieme a lui. */}
      {data.logos.length > 0 ? (
        // Più in alto e più basso di riga rispetto alla firma testuale che
        // sostituiscono: un'immagine leggibile come "logo" ha bisogno di più
        // dei ~10px di una riga di maiuscolo, e senza questo margine
        // finiva addosso alla dicitura legale in fondo (misurato, non
        // supposto: la prima versione ci finiva sopra per un pelo).
        <LogoRow cx={cx} y={588} logos={data.logos} />
      ) : (
        data.issuer && (
          <text
            x={cx}
            y="616"
            textAnchor="middle"
            fill={GOLD_DEEP}
            fontFamily={SANS}
            fontSize="11"
            letterSpacing="3.4"
          >
            {data.issuer.toUpperCase()}
          </text>
        )
      )}

      <text
        x={cx}
        y="634"
        textAnchor="middle"
        fill={INK}
        fontFamily={SANS}
        fontSize="12"
        opacity="0.5"
      >
        {s.disclaimer}
      </text>

      {/* La riga che rende l'attestato controllabile. Chi lo riceve non deve
          fidarsi del PNG — che chiunque saprebbe ritoccare — ma di quello
          che il server risponde a questo indirizzo. L'indirizzo stesso non
          si traduce: è quello che si digita, uguale in ogni lingua. */}
      {data.verificationCode && data.verificationHost && (
        <text
          x={cx}
          y="652"
          textAnchor="middle"
          fill={INK}
          fontFamily={SANS}
          fontSize="12"
          opacity="0.55"
        >
          {`${s.verify}: ${data.verificationHost}/verifica/${data.verificationCode}`}
        </text>
      )}
    </svg>
  );
}
