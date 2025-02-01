'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';
import { getUserId } from '@/lib/userId';
import LanguageSelector from '@/components/LanguageSelector';
import StatusSelector from '@/components/StatusSelector';
import { useStore } from '@/store/useStore';
import { usePathname } from 'next/navigation';
import LocalVideo from '@/components/LocalVideo';
import { TextField, Button } from '@mui/material';
import UserList from '@/components/UserList';
import RemoteVideo from '@/components/RemoteVideo';
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider';
import VideoAudioControls from '@/components/VideoAudioControls';

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
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];
  const { connectionStatus } = useWebRTCContext();

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
    <main className="h-full flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 relative min-h-0">
        {/* RemoteVideo - Always rendered but visibility controlled */}
        <div className={connectionStatus === 'connected' 
          ? 'absolute inset-0 bg-gray-900' 
          : 'absolute opacity-0 pointer-events-none'
        }>
          <RemoteVideo />
        </div>

        {/* Disconnected state content */}
        {connectionStatus !== 'connected' && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Local video at top */}
            <div className="flex justify-center pt-4 flex-shrink-0">
              <LocalVideo />
            </div>

            {/* Scrollable middle content */}
            <div className="flex-1 min-h-0 px-4 overflow-y-auto">
              <div className="mb-4">
                <UserList />
              </div>

              <div className="mb-4">
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
            </div>
          </div>
        )}

        {/* Connected state PiP */}
        {connectionStatus === 'connected' && (
          <div className="absolute bottom-4 right-4 z-10">
            <LocalVideo />
          </div>
        )}
      </div>

      {/* Bottom controls - Always visible */}
      <div className="bg-gray-100 dark:bg-gray-800 p-4 mt-auto">
        <div className="container mx-auto flex justify-end items-center">
          <VideoAudioControls />
        </div>
      </div>
    </main>
  );
} 