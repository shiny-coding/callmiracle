import { User } from "@/generated/graphql"

/**
 * Checks if a user has completed their basic profile
 * 
 * @param user The user object to check
 * @returns boolean indicating if the profile is complete
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false
  
  return !!(
    user.name && 
    user.name.trim() !== '' && 
    user.sex && 
    user.sex.trim() !== '' &&
    user.birthYear
  )
} 