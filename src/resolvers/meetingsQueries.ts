import { Context } from '../types'

export const meetingsQueries = {
  meetings: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    const meetings = await db.collection('meetings').find({ userId }).toArray()
    return meetings
  }
} 