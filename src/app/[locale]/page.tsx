'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Status } from '@/generated/graphql';
import { gql, useMutation } from '@apollo/client';
import { getUserId } from '@/lib/userId';

// Define the status relationships map
const statusRelationships = new Map<Status, Status>([
  [Status.Chat, Status.Chat],
  [Status.MeetNewPeople, Status.MeetNewPeople],
  [Status.SitTogetherInSilence, Status.SitTogetherInSilence],
  [Status.NeedHelpWithSituation, Status.WantToHelpWithSituation],
  [Status.WantToSpeakOut, Status.WantToListen],
]);

const CONNECT_MUTATION = gql`
  mutation Connect($userId: String!, $name: String!, $statuses: [Status!]!) {
    connect(userId: $userId, name: $name, statuses: $statuses) {
      userId
      name
      statuses
      timestamp
    }
  }
`;

export default function Home() {
  const t = useTranslations('Status');
  const tRoot = useTranslations();
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>([]);
  const [connect] = useMutation(CONNECT_MUTATION);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState<string>('');

  // useEffect(() => {
  //   setUserId(getUserId());
  // }, []);

  // Split statuses into left and right columns
  const leftColumnStatuses = Array.from(statusRelationships.keys());
  const rightColumnStatuses = Array.from(new Set(statusRelationships.values()));

  const toggleStatus = (status: Status) => {
    setSelectedStatuses(prev => 
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    try {
      await connect({
        variables: {
          userId,
          name,
          statuses: selectedStatuses
        }
      });
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto mt-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
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