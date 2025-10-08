import { useEntityImage } from './useEntityImage'

export function useGroupImage(groupId: string | undefined, timestamp?: number) {
  return useEntityImage('group', groupId, timestamp)
}
