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

const CONNECT_MUTATION = gql`
  mutation Connect($input: ConnectInput!) {
    connect(input: $input) {
      userId
      name
      statuses
      timestamp
      locale
    }
  }
`;

export default function Home() {
  const tRoot = useTranslations();
  const { name, selectedStatuses, setName } = useStore();
  const [connect] = useMutation(CONNECT_MUTATION);
  const [userId, setUserId] = useState<string>('');
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
            locale: currentLocale
          }
        }
      });
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto mt-8">
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
          <VideoPreview />
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