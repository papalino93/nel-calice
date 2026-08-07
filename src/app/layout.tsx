import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { DonationButton } from "@/components/DonationButton";
import "./globals.css";

const DONATION_URL = "https://buymeacoffee.com/papalino";

// Serif elegante per titoli, numeri di lezione e nome sull'attestato;
// sans geometrica per tutto il resto (§6). I font vengono impacchettati nel
// build: nessuna chiamata a un CDN mentre la pagina si carica.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Corso di Avvicinamento al Vino",
  description:
    "L'Angolo del Vino — corso amatoriale di avvicinamento al vino, serata dopo serata.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>
          <LanguageProvider>
            {children}
            {/* Sempre presente, in ogni pagina (§3.9). */}
            <DonationButton href={DONATION_URL} />
          </LanguageProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
