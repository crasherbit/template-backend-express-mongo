export const CONFIG = {
  cors: {
    origin: process.env.FRONTEND_BASE || '*',
    credentials: true,
    exposedHeaders: 'X-Total-Count',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  },
};
