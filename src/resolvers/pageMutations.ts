import { Context } from './types'
import { setUserCurrentPage } from '@/lib/activeSubscriptions'

export const pageMutations = {
  setCurrentPage: async (
    _: any,
    { page }: { page: string },
    { session }: Context
  ) => {
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }

    setUserCurrentPage(session.user.id, page)
    return true
  }
}
