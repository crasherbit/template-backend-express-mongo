// In-memory challenge store for WebAuthn sessions.
// Key: sessionId (random hex string returned to client in /begin response)
// Value: { challenge, username, expiresAt }
//
// FUTURE: Replace with Redis for multi-instance deployments.

const store = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Store a WebAuthn challenge keyed by sessionId with a 5-minute TTL.
 * @param {string} sessionId
 * @param {{ challenge: string, username: string }} data
 */
export const setChallenge = (sessionId, data) => {
  store.set(sessionId, { ...data, expiresAt: Date.now() + CHALLENGE_TTL_MS });
};

/**
 * Retrieve and consume a challenge (one-time use).
 * Returns null if not found or expired.
 * @param {string} sessionId
 * @returns {{ challenge: string, username: string } | null}
 */
export const getChallenge = (sessionId) => {
  const entry = store.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(sessionId);
    return null;
  }
  store.delete(sessionId); // one-time use
  return entry;
};

/**
 * Remove all expired challenges from the store.
 * Called by the cron job every 5 minutes.
 */
export const cleanExpiredChallenges = () => {
  const now = Date.now();
  for (const [key, value] of store) {
    if (now > value.expiresAt) store.delete(key);
  }
};
