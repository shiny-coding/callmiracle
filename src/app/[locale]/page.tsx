'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { gql, useMutation } from '@apollo/client';
import { getUserId } from '@/lib/userId';
import LanguageSelector from '@/components/LanguageSelector';
import StatusSelector from '@/components/StatusSelector';
import { useStore } from '@/store/useStore';
import { usePathname } from 'next/navigation';
import LocalVideo from '@/components/LocalVideo';
import { TextField, Button, Typography } from '@mui/material';
import UserList from '@/components/UserList';
import RemoteVideo from '@/components/RemoteVideo';
import { WebRTCProvider } from '@/hooks/WebRTCProvider'
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video'

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
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];

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
      <WebRTCProvider 
        localStream={localStream} 
        remoteVideoRef={remoteVideoRef}
        localVideoEnabled={isVideoEnabled}
        localAudioEnabled={isAudioEnabled}
      >
        <div className="flex flex-row flex-wrap gap-4 justify-center">
          <div className="flex flex-row gap-4">
            <div>
              <LocalVideo 
                onStreamChange={setLocalStream} 
                onVideoEnabledChange={setIsVideoEnabled}
                onAudioEnabledChange={setIsAudioEnabled}
              />
            </div>
            <div>
              <RemoteVideo localStream={localStream} remoteVideoRef={remoteVideoRef} />
            </div>
          </div>
          <div className="flex-1 min-w-[320px]">
            <UserList />
          </div>
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
      </WebRTCProvider>
    </main>
  );
} 