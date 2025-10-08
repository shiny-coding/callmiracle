import { useEntityImage } from './useEntityImage'

export function useProfileImage(userId: string | undefined, timestamp?: number) {
  return useEntityImage('user', userId, timestamp)
}
