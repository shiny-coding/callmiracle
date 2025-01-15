import { Status } from '@/generated/graphql';
import clientPromise from '../../lib/mongodb';

export const resolvers = {
  Query: {
    users: async () => {
      const client = await clientPromise;
      const db = client.db("commiracle");
      return await db.collection("users").find({}).toArray();
    },
  },
  Mutation: {
    connect: async (_: any, { userId, name, statuses }: { userId: string, name: string, statuses: string[] }) => {
      const client = await clientPromise;
      const db = client.db();

      const existing = await db.collection('users').findOne({ userId });
      console.log('Existing document:', existing);
      
      const result = await db.collection('users').findOneAndUpdate(
        { userId },
        { 
          $set: { 
            name,
            statuses,
            timestamp: new Date().toISOString(),
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