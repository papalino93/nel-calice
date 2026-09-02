import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { roleForEmail } from "./roles";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // JWT, non un adapter DB: lo schema di User è il nostro (§ prisma/schema.prisma),
  // non quello generico Account/Session/VerificationToken di un adapter NextAuth.
  // Il record applicativo viene creato/aggiornato a mano in `signIn`.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    // Crea o aggiorna la riga User al login. googleId = account.providerAccountId,
    // che per il provider Google è sempre il claim `sub`.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user.email) {
        return false;
      }
      await prisma.user.upsert({
        where: { googleId: account.providerAccountId },
        create: {
          googleId: account.providerAccountId,
          email: user.email,
          name: user.name ?? user.email,
          avatarUrl: user.image ?? null,
        },
        update: {
          email: user.email,
          name: user.name ?? user.email,
          avatarUrl: user.image ?? null,
        },
      });
      return true;
    },

    // Al primo accesso (account presente) recupera l'id interno e la lingua
    // salvata. Il ruolo viene ricalcolato ad OGNI chiamata dall'allowlist
    // ADMIN_EMAILS: se il relatore aggiunge/rimuove un socio, la sessione
    // già aperta lo riflette al giro successivo senza bisogno di re-login.
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { googleId: account.providerAccountId },
          select: { id: true, language: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.language = dbUser.language;
        }
      }
      token.role = await roleForEmail(token.email);
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.role = token.role ?? "corsista";
        session.user.language = token.language ?? "it";
      }
      return session;
    },
  },
};
