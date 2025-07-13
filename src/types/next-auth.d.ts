import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      logLevel?: string
      clientLogLevel?: string
    } & DefaultSession["user"]
  }
  
  interface User {
    id: string
    name: string
    logLevel?: string
    clientLogLevel?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    name: string
    languages?: string[]
    logLevel?: string
    clientLogLevel?: string
    lastDbRefresh?: number
  }
} 