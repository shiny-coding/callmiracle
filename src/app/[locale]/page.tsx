'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Status } from '@/generated/graphql';
import { gql, useMutation } from '@apollo/client';
import { getUserId } from '@/lib/userId';
import LanguageSelector from '@/components/LanguageSelector';
import { useStore } from '@/store/useStore'
import { usePathname } from 'next/navigation';
import VideoPreview from '@/components/VideoPreview'

// Define the status relationships map
const statusRelationships = new Map<Status, Status>([
  [Status.Chat, Status.Chat],
  [Status.MeetNewPeople, Status.MeetNewPeople],
  [Status.SitTogetherInSilence, Status.SitTogetherInSilence],
  [Status.NeedHelpWithSituation, Status.WantToHelpWithSituation],
  [Status.WantToSpeakOut, Status.WantToListen],
]);

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
  const t = useTranslations('Status');
  const tRoot = useTranslations();
  const { name, selectedStatuses, setName, setSelectedStatuses } = useStore()
  const [connect] = useMutation(CONNECT_MUTATION);
  const [userId, setUserId] = useState<string>('');
  const pathname = usePathname()
  const currentLocale = pathname.split('/')[1]

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Split statuses into left and right columns
  const leftColumnStatuses = Array.from(statusRelationships.keys());
  const rightColumnStatuses = Array.from(new Set(statusRelationships.values()));

  const toggleStatus = (status: Status) => {
    setSelectedStatuses(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter(s => s !== status)
        : [...selectedStatuses, status]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    try {
      await connect({
        variables: {
          input: {
            userId,
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
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name:
            </label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Enter your name" 
              required
            />
          </div>
          <VideoPreview />

          <fieldset>
            <legend className="text-sm font-medium mb-4">Select your status:</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-3">
                {leftColumnStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`
                      w-full px-4 py-2 rounded-lg border text-sm font-medium
                      transition-colors duration-200
                      ${selectedStatuses.includes(status)
                        ? 'bg-green-100 border-green-200 hover:bg-green-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    {t(status)}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {rightColumnStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`
                      w-full px-4 py-2 rounded-lg border text-sm font-medium
                      transition-colors duration-200
                      ${selectedStatuses.includes(status)
                        ? 'bg-green-100 border-green-200 hover:bg-green-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    {t(status)}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            id="connect"
            className="w-full bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {tRoot('connect')}
          </button>
        </form>
      </div>
    </main>
  );
} 