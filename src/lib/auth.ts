import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
import { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth/next"
import clientPromise from "./mongodb"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || "",
    }),
    // Credentials provider for username/password login
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Add your own logic here to find the user in your database
        if (credentials?.username === "test" && credentials?.password === "test") {
          return { id: "1", name: "Test User", email: "test@example.com" }
        }
        return null
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      // Send properties to the client
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/signin',
    // signOut: '/auth/signout',
    // error: '/auth/error',
    // verifyRequest: '/auth/verify-request',
    // newUser: '/auth/new-user'
  }
}

export const getServerAuthSession = () => getServerSession(authOptions) 