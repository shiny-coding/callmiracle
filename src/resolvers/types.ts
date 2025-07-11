import { Db } from 'mongodb'
import { Session } from 'next-auth'

export interface Context {
  db: Db
  session: Session | null
  logger: {
    debug: (message: string, meta?: object) => void
    info: (message: string, meta?: object) => void
    warn: (message: string, meta?: object) => void
    error: (message: string, meta?: object) => void
  }
  requestId: string
}
