import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

// Singleton standard per Next.js: in sviluppo il modulo viene ricaricato ad
// ogni hot-reload, e senza questo accorgimento ogni reload aprirebbe una
// nuova connessione al DB finché non si esauriscono i limiti di Neon.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * In produzione (Vercel) il TCP diretto funziona e resta il motore di
 * sempre. `PRISMA_NEON_HTTP=1` esiste solo per gli script una tantum
 * lanciati da reti che non instradano Postgres in TCP — passano dal
 * driver HTTP/WebSocket di Neon, che è comunque HTTPS. Nessuna variabile
 * d'ambiente di produzione lo imposta: il ramo qui sotto non si attiva mai
 * da sé.
 */
function createClient(): PrismaClient {
  if (process.env.PRISMA_NEON_HTTP === "1") {
    // Questo sandbox instrada solo HTTPS: il WebSocket di Neon deve passare
    // per lo stesso proxy che usa già `curl` (HTTPS_PROXY), altrimenti il
    // tunnel cade a livello di rete prima ancora di parlare con Neon.
    const proxyUrl = process.env.HTTPS_PROXY;
    if (proxyUrl) {
      const agent = new HttpsProxyAgent(proxyUrl);
      neonConfig.webSocketConstructor = class extends WebSocket {
        constructor(address: string | URL, protocols?: string | string[]) {
          super(address, protocols, { agent });
        }
      } as unknown as typeof WebSocket;
    } else {
      neonConfig.webSocketConstructor = WebSocket;
    }
    const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL,
    });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
