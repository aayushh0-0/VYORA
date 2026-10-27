/**
 * Exercise ID → YouTube tutorial URL map.
 * Leave null/empty until you add a real URL. Never invent links.
 * Update this file only — plan generation and UI read from here.
 */
export const exerciseTutorials = {
  // Example (disabled until you paste a real link):
  // 'bw-squat': 'https://www.youtube.com/watch?v=YOUR_REAL_ID',
  'bw-squat': null,
  'push-up': null,
  'glute-bridge': null
};

export function getTutorialUrl(exerciseId) {
  if (!exerciseId) return null;
  const url = exerciseTutorials[exerciseId];
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}
