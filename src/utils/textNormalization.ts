export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Remove all diacritical marks while keeping base characters
    .toLowerCase()
    .trim()
} 