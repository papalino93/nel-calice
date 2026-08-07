import { PrismaClient } from "@prisma/client";

// Singleton standard per Next.js: in sviluppo il modulo viene ricaricato ad
// ogni hot-reload, e senza questo accorgimento ogni reload aprirebbe una
// nuova connessione al DB finché non si esauriscono i limiti di Neon.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
