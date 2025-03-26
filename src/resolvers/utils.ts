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
    _id: user._id,
    name: user.name || '',
    languages: user.languages || [],
    timestamp: user.timestamp || Date.now(),
    locale: user.locale || 'en',
    online: user.online || false,
    hasImage: checkUserImage(user._id),
    about: user.about || '',
    contacts: user.contacts || '',
    sex: user.sex || '',
    birthYear: user.birthYear || null,
    blocks: user.blocks || [],
  }
}
