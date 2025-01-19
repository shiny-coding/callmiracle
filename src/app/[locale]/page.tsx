'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';
import { getUserId } from '@/lib/userId';
import LanguageSelector from '@/components/LanguageSelector';
import StatusSelector from '@/components/StatusSelector';
import { useStore } from '@/store/useStore';
import { usePathname } from 'next/navigation';
import VideoPreview from '@/components/VideoPreview';
import { TextField, Button, Typography } from '@mui/material';
import UserList from '@/components/UserList';
import VideoChat from '@/components/VideoChat';

const CONNECT_MUTATION = gql`
  mutation Connect($input: ConnectInput!) {
    connect(input: $input) {
      userId
      name
      statuses
      languages
      timestamp
      locale
    }
  }
`;

export default function Home() {
  const tRoot = useTranslations();
  const { name, selectedLangs, selectedStatuses, setName } = useStore();
  const [connect] = useMutation(CONNECT_MUTATION);
  const [userId, setUserId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>();
  const [localStream, setLocalStream] = useState<MediaStream>();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    const currentUserId = getUserId();
    if (!currentUserId) return;
    
    try {
      await connect({
        variables: {
          input: {
            userId: currentUserId,
            name,
            statuses: selectedStatuses,
            languages: selectedLangs,
            locale: currentLocale
          }
        }
      });
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  return (
    <main className="container mx-auto p-4 space-y-4">
      {/* Video row */}
      <div className="flex flex-row justify-center gap-4">
        <div>
          <Typography variant="h6" className="mb-2">Your Camera</Typography>
          <VideoPreview onStreamChange={setLocalStream} />
        </div>
        <div>
          <Typography variant="h6" className="mb-2">Remote Video</Typography>
          <VideoChat targetUserId={selectedUserId} localStream={localStream} />
        </div>
      </div>

      {/* User list */}
      <div>
        <UserList onUserSelect={setSelectedUserId} localStream={localStream} />
      </div>

      {/* Rest of UI components */}
      <div>
        <LanguageSelector />
        <form className="space-y-6 mt-8" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            id="name"
            name="name"
            label={tRoot('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            variant="outlined"
          />
          <StatusSelector />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            size="large"
          >
            {tRoot('connect')}
          </Button>
        </form>
      </div>
    </main>
  );
} 