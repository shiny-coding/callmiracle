'use client';

import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('Status');
  const statuses = [
    'MEET_NEW_PEOPLE',
    'CHAT',
    'WANT_TO_SPEAK_OUT',
    'WANT_TO_LISTEN',
    'NEED_HELP_WITH_SITUATION',
    'WANT_TO_HELP_WITH_SITUATION'
  ] as const;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto mt-8">
        <form className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name:
            </label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Enter your name" 
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium mb-4">Select your status:</legend>
            <div className="space-y-3">
              {statuses.map((status) => (
                <label key={status} className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    name="status" 
                    value={status}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{t(status)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit
          </button>
        </form>
      </div>
    </main>
  );
} 