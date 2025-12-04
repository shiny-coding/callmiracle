// Shared constants for both frontend and backend

// Messages pagination and limits
export const MESSAGES_PER_PAGE = 15
export const MESSAGE_MAX_LENGTH = 1000

// Call timing constants
export const MAX_CALLING_TIME_MS = 60000 // Maximum time to wait for call to be answered
export const CALL_NOTIFICATION_INTERVAL_MS = 7000 // Interval between repeated incoming call notifications (iOS notifications dismiss after ~7s)