import { Db } from 'mongodb'
import { Session } from 'next-auth'

export interface Context {
  db: Db
  session: Session | null
}
