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

export const authOptions: NextAuthOptions = {
  debug: true,
  adapter: MongoDBAdapter(clientPromise),
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
        console.log("authorize")
        try {
          // Connect to the database
          const client = await clientPromise;
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
      return session
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`[Event: signIn] User: ${user.id}, Email: ${user.email}, New User: ${isNewUser}`);
      if (isNewUser && user.id && (account?.provider === 'google' || account?.provider === 'apple')) {
        try {
          const client = await clientPromise;
          const usersCollection = client.db().collection("users");
          const now = new Date();

          if ( !user.name ) user.name = '';

          await usersCollection.updateOne(
            { _id: new ObjectId(user.id) }, // user.id SHOULD be the MongoDB ID here
            {
              $set: {
                name: user.name,
                createdAt: now, // Good to set here
                updatedAt: now, // Good to set here
                languages: [],
                blocks: [],
                friends: [],
                about: '',
                contacts: '',
                sex: '',
                birthYear: null,
              }
            }
          );
          console.log(`[Event: signIn] Successfully augmented user ${user.id}`);
        } catch (error) {
          console.error(`[Event: signIn] Error augmenting user ${user.id}:`, error);
        }
      }
    }
    // You can add other events like signOut, createUser, updateUser, linkAccount, session
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
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