import { User } from '@/generated/graphql'
import { existsSync } from 'fs'
import { join } from 'path'

// Helper function to check if user has profile image
export const checkUserImage = (userId: string): boolean => {
  const imagePath = join(process.cwd(), 'public', 'profiles', `${userId}.jpg`);
  return existsSync(imagePath);
};

// Helper function to transform MongoDB user document to GraphQL User type
export const transformUser = (user: any): User | null => {
  if (!user) return null
  return {
    userId: user.userId,
    name: user.name || '',
    statuses: user.statuses || [],
    languages: user.languages || [],
    timestamp: user.timestamp || Date.now(),
    locale: user.locale || 'en',
    online: user.online || false,
    hasImage: checkUserImage(user.userId),
    about: user.about || '',
    contacts: user.contacts || '',
    sex: user.sex || null,
    birthYear: user.birthYear || null,
    allowedMales: user.allowedMales ?? true,
    allowedFemales: user.allowedFemales ?? true,
    allowedMinAge: user.allowedMinAge || 10,
    allowedMaxAge: user.allowedMaxAge || 100,
    blocks: user.blocks || []
  }
}
