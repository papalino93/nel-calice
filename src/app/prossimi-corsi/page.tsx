import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, Seal } from "@/components/icons";

export const metadata: Metadata = {
  title: "Prossimi corsi in partenza",
  description:
    "Nel Calice - Corso di Avvicinamento al Vino. Sei serate a tema, prova finale e degustazioni guidate. Prima edizione a 120 euro.",
  alternates: { canonical: "/prossimi-corsi" },
};

type UpcomingCourse = {
  /** Slug reale del corso: è ciò che porta "Iscriviti" dritto al corso
      giusto invece che alla home generica — decisivo appena un secondo
      corso parte in parallelo, perché a quel punto la home da sola non
      saprebbe più a quale dei due si riferisce il codice che l'iscritto
      ha in mano prima ancora di digitarlo. */
  slug: string;
  kicker: string;
  subtitle: string;
  price: string;
  listPrice: string;
  quote: string;
  facts: { n: string; label: string }[];
  lessons: { num: string; title: string; count: number; text: string }[];
};

/**
 * Un solo corso oggi, ma la sezione resta un `.map()`: quando ne parte un
 * secondo basta aggiungere una voce qui, non ridisegnare la pagina.
 *
 * `lessons` e i loro conteggi ripetono a mano quanto già vero nel catalogo
 * (§STATO.md): senza un campo "teaser" sul modello Lesson non c'è ancora un
 * modo di leggerli da lì. Se questa pagina inizia a divergere dal catalogo
 * vale la pena aggiungerlo.
 */
const courses: UpcomingCourse[] = [
  {
    slug: "avvicinamento-2026",
    kicker: "Prima edizione",
    subtitle: "Un percorso pratico per assaggiare, capire e scegliere meglio.",
    price: "120 €",
    listPrice: "150 €",
    quote:
      "Si assaggia, si sbaglia, si impara — e intanto si ride, si chiacchiera e si condivide quello che c'è nel calice.",
    facts: [
      { n: "6", label: "serate a tema, con esame finale" },
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
          className="press text-sm text-cream/60 underline underline-offset-4 hover:text-cream"
        >
          Accedi
        </Link>
      </header>

      <section className="rise-in mt-11 grid items-center gap-9 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.24em] text-gold">
            Corsi in partenza
          </p>
          <h1 className="mt-2.5 whitespace-nowrap font-serif text-[26px] leading-[1.05] font-normal text-cream sm:text-[33px]">
            Corso di Avvicinamento al Vino
          </h1>
          <p className="mt-3 font-serif text-lg italic leading-[1.3] text-gold-light sm:text-[21px]">
            Capire il vino, senza il tecnicismo del sommelier.
          </p>
          <p className="mt-3.5 text-pretty text-[16.5px] leading-[1.6] font-light text-cream/82">
            Un corso per chiunque ami il mondo del vino, o vorrebbe anche solo
            conoscerlo meglio — senza esperienza alcuna: senza paura di
            sbagliare, impariamo quello che ci serve — cosa ci comunica, cosa
            ci fa sentire — senza inutili tecnicismi. Un clima conviviale, tra
            degustazioni, chiacchiere, sorrisi e qualche nozione. Alla fine
            del percorso entri in enoteca sapendo cosa chiedere.
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

      <div className="mt-2">
        {courses.map((course, i) => (
          <section
            key={course.slug}
            className={`mt-9 ${i > 0 ? "border-t border-gold/22 pt-[30px]" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cream/55">
                  {course.kicker}
                </p>
                <p className="mt-1.5 max-w-[520px] text-[15px] leading-[1.55] text-cream/70">
                  {course.subtitle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-cream/50">
                  Prezzo di lancio
                </p>
                <div className="mt-1 flex items-baseline justify-end gap-2.5">
                  <span className="font-serif text-4xl text-cream [word-spacing:-0.18em]">
                    {course.price}
                  </span>
                  <span className="text-[15px] text-cream/45 line-through">
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

            <p className="mt-[26px] mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-cream/50">
              Le sei serate
            </p>
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
                  <h3 className="mt-[3px] font-serif text-[17.5px] text-cream">
                    {l.title}
                  </h3>
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
              <Link
                href={`/corso/${course.slug}`}
                className="press lift inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform"
              >
                Iscriviti a questo corso <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-6 rounded-[12px] border border-gold/40 bg-cream-soft px-7 py-[26px] text-charcoal">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bordeaux">
            Informazioni e iscrizioni
          </p>
          <div className="mt-2.5 flex flex-wrap gap-[22px]">
            {contacts.map((contact) => (
              <a
                key={contact.href}
                href={contact.href}
                className="press inline-flex items-baseline gap-1.5 text-sm font-medium text-charcoal"
              >
                <span>{contact.name}</span>
                <span className="font-serif text-[17px] text-bordeaux">
                  {contact.phone}
                </span>
              </a>
            ))}
          </div>
        </div>
        <Link
          href="/"
          className="press lift inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-bordeaux px-6 py-3 text-sm font-medium text-cream transition-transform"
        >
          Vai alla piattaforma <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
