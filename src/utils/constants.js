export const Path = Object.freeze({
  AUTH: '/auth',
  PRODUCT: '/product',
  ORDER: '/order',
});

export const Roles = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

export const AUTH_COOKIE_NAME = 'authToken';
export const USERNAME_REGEX = /^[a-zA-Z0-9._\-]{3,25}$/;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes — keep aligned with cron schedule in src/cron/index.js
export const JWT_EXPIRY = '7d';
