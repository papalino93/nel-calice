import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      language: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    language?: string;
  }
}
