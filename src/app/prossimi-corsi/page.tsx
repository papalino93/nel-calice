import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, Seal } from "@/components/icons";

export const metadata: Metadata = {
  title: "Prossimi corsi in partenza",
  description:
    "Nel Calice - Corso di Avvicinamento al Vino. Sei serate con degustazioni guidate, esame finale compreso. Prima edizione a 120 euro.",
  alternates: { canonical: "/prossimi-corsi" },
};

type UpcomingCourse = {
  /** Slug reale del corso: è ciò che porta "Iscriviti" dritto al corso
      giusto invece che alla home generica — decisivo appena un secondo
      corso parte in parallelo, perché a quel punto la home da sola non
      saprebbe più a quale dei due si riferisce il codice che l'iscritto
      ha in mano prima ancora di digitarlo. */
  slug: string;
  title: string;
  kicker: string;
  enrollmentLabel: string;
  subtitle: string;
  price: string;
  listPrice: string;
  quote: string;
  facts: { n: string; label: string }[];
  lessons: { num: string; title: string; count: number; text: string }[];
};

/**
 * Ogni voce descrive un'edizione pubblica. Quando parte un secondo corso si
 * aggiunge qui una nuova scheda: hero, CTA, programma e iscrizione restano
 * identici, ma ogni percorso mantiene il proprio slug e i propri dettagli.
 *
 * `lessons` e i loro conteggi ripetono a mano quanto già vero nel catalogo
 * (§STATO.md): senza un campo "teaser" sul modello Lesson non c'è ancora un
 * modo di leggerli da lì. Se questa pagina inizia a divergere dal catalogo
 * vale la pena aggiungerlo.
 */
const courses: UpcomingCourse[] = [
  {
    slug: "avvicinamento-2026",
    title: "Corso di Avvicinamento al Vino",
    kicker: "Prima edizione",
    enrollmentLabel: "Iscrizioni aperte · posti limitati",
    subtitle:
      "Un corso dove si beve, si impara, si ride e — va detto — qualche volta si sbaglia pure. Sei serate conviviali per scoprire davvero cosa c'è in un bicchiere, tra degustazioni guidate, aneddoti e qualche trucco del mestiere. Alla fine sarai capace di entrare in enoteca e dire con sicurezza esattamente che vino vuoi.",
    price: "120 €",
    listPrice: "150 €",
    quote:
      "Nessuno qui deve dimostrare niente: si viene per curiosità, si resta per il piacere di stare a tavola con un buon calice in mano.",
    facts: [
      { n: "6", label: "serate in tutto, esame finale compreso" },
      { n: "3-4", label: "vini in degustazione ogni serata" },
      { n: "20", label: "posti in tutto, non uno di più" },
      { n: "0", label: "esperienza richiesta per iniziare" },
    ],
    lessons: [
      {
        num: "01",
        title: "Sensi",
        count: 9,
        text: "La scheda di degustazione, e le tre figure — viticoltore, agronomo, enologo — che decidono un vino prima ancora che si stappi.",
      },
      {
        num: "02",
        title: "Bianchi e Rosati",
        count: 9,
        text: "Il colore si decide con le bucce, non con l'uva: tre modi di ottenere un bianco o un rosato dalla stessa vendemmia.",
      },
      {
        num: "03",
        title: "Vini Rossi",
        count: 8,
        text: 'Non per forza "grandi": perché il tannino non è un difetto, e cosa succede davvero dentro al tino di fermentazione.',
      },
      {
        num: "04",
        title: "Bollicine",
        count: 10,
        text: "Tre modi diversi di far nascere le bolle, dal più semplice al più lento e prezioso.",
      },
      {
        num: "05",
        title: "Vini Dolci",
        count: 8,
        text: 'Tre modi di "rubare tempo" all\'uva, e un giro d\'Italia fra i dolci meno conosciuti.',
      },
      {
        num: "F.",
        title: "Esame Finale",
        count: 30,
        text: "Riepilogo di tutto il percorso: è la lezione che vale di più per l'attestato.",
      },
    ],
  },
];

const contacts = [
  { name: "Andrea", phone: "338 327 7053", href: "tel:+393383277053" },
  { name: "Andrea", phone: "338 787 1358", href: "tel:+393387871358" },
  { name: "Manuel", phone: "347 855 1060", href: "tel:+393478551060" },
];

/** Pagina pubblica: la destinazione dei QR sulle locandine e dei link
    condivisi. Non richiede Google: serve prima di decidere di partecipare. */
export default function UpcomingCoursesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="press inline-flex items-center gap-3 text-cream/90 hover:text-cream"
        >
          <Seal size={42} />
          <span className="font-serif text-xl">Nel Calice</span>
        </Link>
        <Link
          href="/"
          className="press inline-flex min-h-11 items-center text-sm text-cream/70 underline underline-offset-4 hover:text-cream"
        >
          Accedi
        </Link>
      </header>

      <section className="rise-in mt-11 grid items-center gap-9 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.24em] text-gold">
            Corsi in partenza
          </p>
          <h1 className="mt-2.5 font-serif text-[30px] leading-[1.05] font-normal text-cream sm:text-[38px]">
            I prossimi corsi «Nel Calice»
          </h1>
          <p className="mt-3 font-serif text-lg italic leading-[1.3] text-gold-light sm:text-[21px]">
            Percorsi per assaggiare, capire e scegliere meglio.
          </p>
          <p className="mt-3.5 text-pretty text-[16.5px] leading-[1.6] font-light text-cream/82">
            Ogni edizione ha il suo programma, i suoi vini e il suo ritmo.
            Scegli quella che fa per te: niente esperienza richiesta, solo
            curiosità, calici e voglia di scoprire.
          </p>
          <a
            href="https://maps.google.com/?q=Enoteca+L%27Angolo+del+Vino%2C+Via+dei+Rossi+53C%2C+Scandicci"
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-5 inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-medium text-cream"
          >
            <MapPinIcon className="h-[17px] w-[17px] shrink-0 text-gold" />
            <span className="underline decoration-gold/40 underline-offset-[3px]">
              Enoteca L&apos;Angolo del Vino — Via dei Rossi 53C, Scandicci
            </span>
          </a>
          <Link
            href="#corsi"
            className="press lift mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform"
          >
            Scopri i corsi <span aria-hidden>↓</span>
          </Link>
        </div>
        <div className="relative h-[230px] overflow-hidden rounded-[10px]">
          <Image
            src="/prossimi-corsi/foto-degustazione.png"
            alt="Degustazione all'Enoteca L'Angolo del Vino"
            fill
            sizes="(min-width: 1024px) 35vw, 90vw"
            className="object-cover object-[50%_30%]"
            priority
          />
        </div>
      </section>

      <div id="corsi" className="mt-12 scroll-mt-6">
        {courses.map((course, i) => (
          <section
            key={course.slug}
            className={`mt-9 ${i > 0 ? "border-t border-gold/22 pt-[30px]" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cream/60">
                  {course.kicker}
                </p>
                <h2 className="mt-1 font-serif text-[27px] leading-tight text-cream sm:text-[31px]">
                  {course.title}
                </h2>
                <p className="mt-1.5 max-w-[520px] text-[15px] leading-[1.55] text-cream/70">
                  {course.subtitle}
                </p>
                <p className="mt-3 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                  {course.enrollmentLabel}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-cream/60">
                  Prezzo di lancio
                </p>
                <div className="mt-1 flex items-baseline justify-end gap-2.5">
                  <span className="font-serif text-4xl text-cream [word-spacing:-0.18em]">
                    {course.price}
                  </span>
                  <span className="text-[15px] text-cream/60 line-through">
                    {course.listPrice}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-[22px] grid grid-cols-2 gap-[18px] min-[480px]:grid-cols-4">
              {course.facts.map((f) => (
                <div key={f.label}>
                  <p className="font-serif text-[38px] text-gold">{f.n}</p>
                  <p className="mt-1 text-[13px] leading-[1.35] text-cream/65">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>

            <h3 className="mt-[26px] mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-cream/60">
              Il programma
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {course.lessons.map((l) => (
                <div
                  key={l.num}
                  className="rounded-[8px] border border-gold/20 px-4 py-3.5"
                >
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="font-serif text-[22px] text-gold/75">
                      {l.num}
                    </span>
                    <span className="text-[10.5px] text-gold">
                      {l.count} domande
                    </span>
                  </div>
                  <h4 className="mt-[3px] font-serif text-[17.5px] text-cream">
                    {l.title}
                  </h4>
                  <p className="mt-[3px] text-[12.5px] leading-[1.42] text-cream/60">
                    {l.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-[22px] flex flex-wrap items-center justify-between gap-5">
              <p className="max-w-[420px] font-serif text-[17px] italic leading-[1.4] text-gold-light">
                {course.quote}
              </p>
              {/* Chi arriva dalla locandina non ha il codice detto in aula,
                  quindi il pulsante principale non può portare al corso: lì
                  troverebbe prima Google e poi un campo che non sa
                  riempire. Porta dove ci si iscrive davvero, cioè ai
                  contatti. Il corso resta raggiungibile dal collegamento
                  sotto, per chi il codice ce l'ha già. */}
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <a
                  href="#iscrizioni"
                  className="press lift inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform"
                >
                  Come iscriversi <span aria-hidden>↓</span>
                </a>
                <Link
                  href={`/corso/${course.slug}`}
                  className="press inline-flex min-h-10 items-center text-[13px] text-cream/70 underline underline-offset-4 hover:text-cream"
                >
                  Hai già il codice? Entra nel corso
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section
        id="iscrizioni"
        className="mt-10 flex scroll-mt-6 flex-wrap items-center justify-between gap-6 rounded-[12px] border border-gold/40 bg-cream-soft px-7 py-[26px] text-charcoal"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bordeaux">
            Informazioni e iscrizioni
          </p>
          {/* Detto per esteso: è il punto in cui atterra «Come iscriversi»,
              e un elenco di numeri senza una riga sopra non spiega da sé
              che è così che ci si iscrive. Quando ci sarà una mail, va
              accanto ai numeri qui sotto. */}
          <p className="mt-2 max-w-[440px] text-sm leading-[1.5] text-charcoal/75">
            Per iscriverti o chiedere qualsiasi cosa, chiamaci o scrivici su
            WhatsApp: i posti sono venti e si assegnano in ordine di
            prenotazione.
          </p>
          {/* Ognuno è un pulsante vero, non testo colorato: da telefono —
              cioè da chi inquadra il QR sulla locandina — questi tre sono
              l'azione della pagina, e prima non si distinguevano dal testo
              intorno. Il bordo li rende toccabili a vista, senza rubare la
              scena con tre pieni bordeaux uno accanto all'altro. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <a
                key={contact.href}
                href={contact.href}
                className="press lift inline-flex min-h-11 items-center gap-1.5 rounded-full border border-bordeaux/35 bg-bordeaux/[0.06] px-4 py-2 text-sm font-medium text-charcoal transition-transform hover:border-bordeaux/60"
              >
                <span>{contact.name}</span>
                <span className="font-serif text-[17px] text-bordeaux">
                  {contact.phone}
                </span>
              </a>
            ))}
          </div>
        </div>
        {/* Secondario rispetto ai numeri, e apposta: questa sezione è dove
            atterra chi deve ancora prenotare, e per lui l'azione sono i
            contatti qui sopra. In pieno bordeaux era l'elemento più
            vistoso del riquadro pur portando al login, che serve a chi è
            già iscritto. Resta un bersaglio da 44px, solo più discreto. */}
        <Link
          href="/"
          className="press inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-bordeaux underline decoration-bordeaux/40 underline-offset-4 hover:decoration-bordeaux"
        >
          Sei già iscritto? Vai alla piattaforma <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
