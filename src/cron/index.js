import cron from 'node-cron';
import { cleanExpiredChallenges } from '../api/v1/auth/challengeStore.js';

export const cronManager = () => {
  // Purge expired WebAuthn challenges every 5 minutes.
  // Challenges have a 5-minute TTL; this ensures the in-memory Map does not grow indefinitely.
  cron.schedule('*/5 * * * *', () => {
    cleanExpiredChallenges();
  });
};
