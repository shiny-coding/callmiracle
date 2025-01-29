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
import { WebRTCProvider } from '@/components/WebRTCProvider'
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
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];

  const handleTrack = (event: RTCTrackEvent) => {
    console.log('VideoChat: OnTrack', event);
    if (event.track.kind === 'video') {
      if (remoteVideoRef.current && event.streams[0]) {
        console.log('VideoChat: Received remote stream');
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    }
  };

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
      <WebRTCProvider localStream={localStream} onTrack={handleTrack}>
        <div>
          <UserList />
        </div>
        <div className="flex flex-row justify-center gap-4">
          <div>
            <Typography variant="h6" className="mb-2">Your Camera</Typography>
            <LocalVideo onStreamChange={setLocalStream} />
          </div>
          <div>
            <Typography variant="h6" className="mb-2">Remote Video</Typography>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
              className="rounded-lg shadow-lg object-cover"
            />
            <RemoteVideo localStream={localStream} />
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