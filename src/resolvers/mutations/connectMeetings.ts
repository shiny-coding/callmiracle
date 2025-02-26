
const SLOT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

type TimeRange = {
  start: number;
  end: number;
}

// Helper function to combine adjacent time slots into time ranges
export const combineAdjacentSlots = (slots: number[]): TimeRange[] => {
  if (slots.length === 0) return [];
  
  // Sort slots chronologically
  const sortedSlots = [...slots].sort((a, b) => a - b);
  
  const now = new Date().getTime();
  const combinedSlots: TimeRange[] = [];
  let currentStart, currentEnd;
  
  for (let i = 0; i < sortedSlots.length; i++) {
    let slotStart = sortedSlots[i];
    const slotEnd = slotStart + SLOT_DURATION;
    if (now >= slotEnd) continue;
    if (now > slotStart) {
      slotStart = now;
    }
      
    // If this slot starts exactly when the previous ends, combine them
    if (slotStart === currentEnd) {
      // Extend the current slot
      currentEnd = slotEnd;
    } else {
      // This slot is not adjacent, so save the current combined slot and start a new one
      if (currentStart) {
        combinedSlots.push({ start: currentStart, end: currentEnd as number });
      }
      currentStart = slotStart;
      currentEnd = slotEnd;
    }
  }
  
  // Add the last range
  if (currentStart) {
    combinedSlots.push({ start: currentStart, end: currentEnd as number });
  }
  return combinedSlots;
}

// Helper function to find overlapping time ranges
export const findOverlappingRanges = (ranges1: TimeRange[], ranges2: TimeRange[], minDuration: number): TimeRange[] => {
  const overlaps: TimeRange[] = [];

  const minDurationMs = minDuration * 60 * 1000;
  
  for (const range1 of ranges1) {
    for (const range2 of ranges2) {
      const overlapStart = Math.max(range1.start, range2.start);
      const overlapEnd = Math.min(range1.end, range2.end);
      const duration = overlapEnd - overlapStart;
      
      if (duration >= minDurationMs) {
        overlaps.push({ start: overlapStart, end: overlapEnd });
      }
    }
  }
  
  return overlaps;
}

// Helper function to check if two meetings can be connected
export const canConnectMeetings = (meeting1: any, meeting2: any, users: any[]) => {
  // Check if meetings are from different users
  if (meeting1.userId === meeting2.userId) return false;
  
  // Find the users
  const user1 = users.find(u => u.userId === meeting1.userId);
  const user2 = users.find(u => u.userId === meeting2.userId);
  if (!user1 || !user2) return false;
  
  // Check gender preferences
  if (user1.sex === 'male' && !meeting2.allowedMales) return false;
  if (user1.sex === 'female' && !meeting2.allowedFemales) return false;
  if (user2.sex === 'male' && !meeting1.allowedMales) return false;
  if (user2.sex === 'female' && !meeting1.allowedFemales) return false;
  
  // Check age preferences
  if (user1.birthYear) {
    const age1 = new Date().getFullYear() - user1.birthYear;
    if (age1 < meeting2.allowedMinAge || age1 > meeting2.allowedMaxAge) return false;
  }
  if (user2.birthYear) {
    const age2 = new Date().getFullYear() - user2.birthYear;
    if (age2 < meeting1.allowedMinAge || age2 > meeting1.allowedMaxAge) return false;
  }
  
  // Check language overlap
  const languageOverlap = meeting1.languages.filter((lang: string) => 
    meeting2.languages.includes(lang)
  );
  if (languageOverlap.length === 0) return false;
  
  // Check status overlap
  const statusOverlap = meeting1.statuses.filter((status: string) => 
    meeting2.statuses.includes(status)
  );
  if (statusOverlap.length === 0) return false;
  
  // Check time slot overlap
  const minDuration = Math.max(meeting1.minDuration, meeting2.minDuration);
  
  // Combine adjacent slots into time ranges
  const timeRanges1 = combineAdjacentSlots(meeting1.timeSlots);
  const timeRanges2 = combineAdjacentSlots(meeting2.timeSlots);
  
  // Find overlapping time ranges
  const overlappingRanges = findOverlappingRanges(timeRanges1, timeRanges2, minDuration);
  
  return overlappingRanges.length > 0 ? overlappingRanges : false;
}

// Helper function to determine the best start time
export const determineBestStartTime = (overlappingRanges: TimeRange[], meeting1: any, meeting2: any) => {
  // Sort slots by start time
  const sortedRanges = [...overlappingRanges].sort((a, b) => a.start - b.start);
  
  // Calculate durations for all slots
  const oneHourInMs = 60 * 60 * 1000;
  const rangesWithDurations = sortedRanges.map(range => ({
    ...range,
    duration: range.end - range.start
  }));
  
  let rangesToChooseFrom;
  // Find slots with at least one hour duration
  const longRanges = rangesWithDurations.filter(range => range.duration >= oneHourInMs);
  
  // If we have slots with at least one hour duration, choose among those
  if (longRanges.length > 0) {
    rangesToChooseFrom = longRanges;
  } else {
    const maxDuration = Math.max(...rangesWithDurations.map(range => range.duration));
    // Find all slots with the maximum duration
    rangesToChooseFrom = rangesWithDurations.filter(range => range.duration === maxDuration);    
  }

  // If both prefer earlier, choose the earliest long slot
  if (meeting1.preferEarlier && meeting2.preferEarlier) {
    return rangesToChooseFrom[0].start;
  }
    
  // If both prefer later, choose the latest long slot
  if (!meeting1.preferEarlier && !meeting2.preferEarlier) {
    return rangesToChooseFrom[rangesToChooseFrom.length - 1].start;
  }
    
  // If preferences differ, choose a middle long slot
  return rangesToChooseFrom[Math.floor(rangesToChooseFrom.length / 2)].start;
}
