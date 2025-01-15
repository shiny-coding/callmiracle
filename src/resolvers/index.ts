import { Status } from '@/generated/graphql';
import clientPromise from '../../lib/mongodb';
import { Context } from 'graphql';
import { ConnectInput } from '@/generated/graphql';

export const resolvers = {
  Query: {
    users: async () => {
      const client = await clientPromise;
      const db = client.db("commiracle");
      return await db.collection("users").find({}).toArray();
    },
  },
  Mutation: {
    connect: async (_: any, { input }: { input: ConnectInput }, { db }: Context) => {
      const { userId, name, statuses, locale } = input;
      const timestamp = new Date().toISOString();

      const result = await db.collection('users').findOneAndUpdate(
        { userId },
        { 
          $set: { 
            name, 
            statuses, 
            timestamp,
            locale 
          } 
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );

      return result;
    }
  }
}; 