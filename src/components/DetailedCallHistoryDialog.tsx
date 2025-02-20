import { useDetailedCallHistory } from '@/store/DetailedCallHistoryProvider'
import DetailedCallHistory from './DetailedCallHistory'

export default function DetailedCallHistoryDialog() {
  const { selectedUser, setSelectedUser } = useDetailedCallHistory()

  if (!selectedUser) return null

  return (
    <DetailedCallHistory
      user={selectedUser}
      open={!!selectedUser}
      onClose={() => setSelectedUser(null)}
    />
  )
} 