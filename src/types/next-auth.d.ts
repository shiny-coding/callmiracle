import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"
import { SectionLogLevels } from "@/utils/clientLogger"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      logLevel?: string
      clientLogLevel?: string
      clientSectionLogLevels?: SectionLogLevels
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    name: string
    logLevel?: string
    clientLogLevel?: string
    clientSectionLogLevels?: SectionLogLevels
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    name: string
    languages?: string[]
    logLevel?: string
    clientLogLevel?: string
    clientSectionLogLevels?: SectionLogLevels
    lastDbRefresh?: number
  }
} 