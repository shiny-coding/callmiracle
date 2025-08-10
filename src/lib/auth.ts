import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
import { NextAuthOptions, User } from "next-auth"
import { getServerSession } from "next-auth/next"
import clientPromise from "./mongodb"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcrypt"
import { ObjectId } from 'mongodb'
import NextAuth from "next-auth"
import { cookies } from 'next/headers'
import { defaultLogLevel, defaultClientLogLevel } from "@/utils/logUtils"
import { isBuilding } from '@/utils'

// Build-time mock adapter
const mockAdapter = {
  createUser: async () => null,
  getUser: async () => null,
  getUserByEmail: async () => null,
  getUserByAccount: async () => null,
  updateUser: async () => null,
  deleteUser: async () => null,
  linkAccount: async () => null,
  unlinkAccount: async () => null,
  createSession: async () => null,
  getSessionAndUser: async () => null,
  updateSession: async () => null,
  deleteSession: async () => null,
  createVerificationToken: async () => null,
  useVerificationToken: async () => null,
}

export const authOptions: NextAuthOptions = {
  debug: false,
  adapter: isBuilding ? mockAdapter as any : MongoDBAdapter(clientPromise),
  jwt: {
    // Use standard JWT (signed only) instead of JWE for OpenTelemetry compatibility
    encode: async ({ secret, token }) => {
      if (!token) return ''
      const jwt = await import('jsonwebtoken')
      
      // Check if token already has exp property to avoid conflict
      const signOptions: any = {
        algorithm: "HS256"
      }
      
      // Only set expiresIn if token doesn't already have exp
      if (!token.exp) {
        signOptions.expiresIn = 30 * 24 * 60 * 60 // 30 days
      }
      
      return jwt.sign({ ...token }, secret, signOptions)
    },
    decode: async ({ secret, token }) => {
      if (!token) return null
      try {
        const jwt = await import('jsonwebtoken')
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] })
        return decoded as any
      } catch (error) {
        console.error('JWT decode error:', error)
        return null
      }
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    AppleProvider({
      clientId: process.env.AUTH_APPLE_ID || "",
      clientSecret: process.env.AUTH_APPLE_SECRET || "",
      authorization: {
        params: {
          scope: "name email",
        },
      },
    }),
    // Credentials provider for username/password login
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          // Connect to the database
          const client = await clientPromise;
          if (!client) {
            console.log("MongoDB client not available during build");
            return null;
          }
          const usersCollection = client.db().collection("users");
          
          // Find the user by email
          const user = await usersCollection.findOne({ 
            email: credentials?.email?.toLowerCase() 
          });
          
          // Check if user exists
          if (user) {
            // If user exists but doesn't have a password, they likely used a social login
            if (!user.password) {
              // Check which provider they used
              const accountsCollection = client.db().collection("accounts");
              const account = await accountsCollection.findOne({ userId: user._id });
              
              if (account) {
                // Throw an error with the provider information
                throw new Error(`provider_${account.provider}`);
              }
            }
            
            // Check if password matches
            if (await compare(credentials?.password || '', user.password)) {
              return {
                ...user,
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.image,
              } as User
            }
          }
          
          return null;
        } catch (error) {
          console.error("Error in credentials authorization:", error);
          // Rethrow provider errors so they can be handled in the signin page
          if (error instanceof Error && error.message.startsWith('provider_')) {
            throw error;
          }
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      return true;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token.sub) {
        session.user.id = token.sub
      }
      if (token.name) {
        session.user.name = token.name
      }
      if (token.logLevel) {
        session.user.logLevel = token.logLevel
      }
      if (token.clientLogLevel) {
        session.user.clientLogLevel = token.clientLogLevel
      }
      return session
    },
    async jwt({ token, user, account, profile }) {
      const REFRESH_FROM_DB_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (user) {
        token.id = user.id
        token.name = user.name || user.email || 'Unknown User'
        token.languages = (user as any).languages || []
        token.logLevel = (user as any).logLevel || 'info'
        token.clientLogLevel = (user as any).clientLogLevel || 'warn'
        token.lastDbRefresh = Date.now()
      } else if (token.id) {
        const now = Date.now()
        const lastRefresh = token.lastDbRefresh as number || 0
        const shouldRefreshFromDb = now - lastRefresh > REFRESH_FROM_DB_INTERVAL
        
        // Check if we need to fetch missing fields or refresh log levels
        const needsBasicFields = !token.name || !token.languages || token.languages.length === 0 || !token.logLevel || !token.clientLogLevel
        
        if (needsBasicFields || shouldRefreshFromDb) {
          try {
            const client = await clientPromise;
            if (client) {
              const usersCollection = client.db().collection("users");
              const dbUser = await usersCollection.findOne({ 
                _id: new ObjectId(token.id as string) 
              });
              
              if (dbUser) {
                token.name = dbUser.name;
                token.languages = dbUser.languages;
                token.logLevel = dbUser.logLevel || defaultLogLevel;
                token.clientLogLevel = dbUser.clientLogLevel || defaultClientLogLevel;
                
                token.lastDbRefresh = now;
              }
            }
          } catch (error) {
            console.error('Error fetching user data in JWT callback:', error);
          }
        }
      }
      return token
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      
      const cookieStore = await cookies()
      const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'

      if (user.id) {
        try {
          const client = await clientPromise;
          if (!client) {
            console.log("MongoDB client not available during build");
            return;
          }
          const usersCollection = client.db().collection("users");
          const now = new Date();

          const updateData: any = {
            locale: locale,
          }
          if (isNewUser && (account?.provider === 'google' || account?.provider === 'apple')) {
            if ( !user.name ) user.name = '';

            updateData.name = user.name
            updateData.createdAt = now // Good to set here
            updateData.updatedAt = now // Good to set here
            updateData.languages = []
            updateData.blocks = []
            updateData.friends = []
            updateData.about = ''
            updateData.contacts = ''
            updateData.sex = ''
            updateData.birthYear = null
            updateData.groups = []
            updateData.logLevel = defaultLogLevel
            updateData.clientLogLevel = defaultClientLogLevel
          }

          await usersCollection.updateOne(
            { _id: new ObjectId(user.id) },
            { $set: updateData }
          );
        } catch (error) {
          console.error(`[Event: signIn] Error augmenting user ${user.id}:`, error);
        }
      }
    }
    // You can add other events like signOut, createUser, updateUser, linkAccount, session
  },
  cookies: {
    pkceCodeVerifier: {
      name: '__Secure-next-auth.pkce.code_verifier',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true }
    },
    state: {
      name: '__Secure-next-auth.state',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true }
    }
  },
}

export const getServerAuthSession = () => getServerSession(authOptions) 

export default NextAuth(authOptions) 