import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, CrossIcon, Seal } from "@/components/icons";
import { formatVerificationCode, verifyCertificate } from "@/lib/verification";

// Pagina pubblica: chi riceve un attestato deve poterlo controllare senza
// avere un account. È l'unico punto dell'app che risponde a chi non è né
// iscritto né relatore, ed è deliberato — un controllo che richiede di
// registrarsi non lo fa nessuno, e l'attestato tornerebbe a valere quanto
// vale un PNG.
//
// Resta in italiano, come l'attestato che verifica.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Solo "Verifica attestato": il modello del layout aggiunge già il nome
  // del corso, e prima il titolo usciva col suffisso ripetuto due volte.
  title: "Verifica attestato",
  // Fuori dai motori di ricerca: la pagina porta il nome di una persona, e
  // chi ha diritto di vederla ci arriva dal codice, non da una ricerca.
  robots: { index: false, follow: false },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-cream/10 py-3 first:border-t-0">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-gold/80">
        {label}
      </p>
      <p className="mt-1 font-serif text-lg leading-tight text-cream">
        {value}
      </p>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Niente `decodeURIComponent` qui: Next consegna il segmento già
  // decodificato, quindi decodificarlo di nuovo su un codice che contiene
  // un `%` (`/verifica/100%25AB` diventa `100%AB`) lanciava `URIError` e
  // mandava il visitatore sulla pagina di errore di Next invece che sul
  // messaggio scritto qui sotto. `normalize()` in verification.ts scarta
  // già tutto ciò che non è alfanumerico.
  const certificate = await verifyCertificate(code);

  // Quello che il visitatore ha davvero digitato, ripulito ma NON tagliato:
  // tagliare a sedici e poi dire «sono sedici caratteri» faceva sembrare
  // giusto un codice di diciassette.
  const attempted = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

  return (
    <main className="flex flex-1 flex-col items-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <Seal size={60} />
          <h1 className="mt-4 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-gold">
            Verifica attestato
          </h1>
        </div>

        {certificate ? (
          <section className="card overflow-hidden p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-charcoal">
                <CheckIcon className="h-4 w-4" />
              </span>
              <p className="text-sm leading-snug text-cream">
                Attestato autentico.
              </p>
            </div>

            <Row label="Intestato a" value={certificate.name} />
            <Row label="Corso" value={certificate.courseTitle} />
            <Row label="Titolo conseguito" value={certificate.meritTitle} />
            {certificate.completedOn && (
              <Row
                label="Corso concluso il"
                value={formatDate(certificate.completedOn)}
              />
            )}

            <p className="mt-5 border-t border-cream/10 pt-4 text-xs leading-relaxed text-cream/60">
              Questi dati arrivano ora dal server del corso, non dal file che
              ti è stato mostrato: un&apos;immagine ritoccata non li
              cambierebbe. Attestato di partecipazione a un corso amatoriale —
              non è una qualifica professionale.
            </p>
          </section>
        ) : (
          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cream/25 text-cream/60">
                <CrossIcon className="h-4 w-4" />
              </span>
              <p className="text-sm leading-snug text-cream">
                Nessun attestato con questo codice.
              </p>
            </div>

            <p className="text-xs leading-relaxed text-cream/60">
              Il codice cercato è{" "}
              <span className="font-mono text-cream/80">
                {formatVerificationCode(attempted.slice(0, 16)) || "—"}
              </span>
              {attempted.length !== 16 ? (
                <>
                  , che di caratteri ne ha {attempted.length} invece di
                  sedici. Ricopialo per intero da sotto l&apos;attestato.
                </>
              ) : (
                <>
                  . Sono sedici caratteri, stampati in fondo
                  all&apos;attestato: controlla di non aver confuso uno zero
                  con una O, o un uno con una I. Se è giusto e la pagina dice
                  ancora così, l&apos;attestato non è stato rilasciato da
                  questo corso.
                </>
              )}
            </p>
          </section>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="press inline-flex min-h-10 items-center text-sm text-gold underline underline-offset-4"
          >
            Vai al corso
          </Link>
        </div>
      </div>
    </main>
  );
}
