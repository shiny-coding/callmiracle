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
import { TextField, Button } from '@mui/material';
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
  const [localStream, setLocalStream] = useState<MediaStream | undefined>();
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
    <main className="min-h-screen p-8 pt-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Left Column */}
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

        {/* Right Column */}
        <div className="space-y-6">
          <div className="space-y-4">
            <VideoPreview onStreamChange={setLocalStream} />
            <VideoChat targetUserId={selectedUserId} localStream={localStream} />
          </div>
          <UserList onUserSelect={setSelectedUserId} localStream={localStream} />
        </div>
      </div>
    </main>
  );
} 