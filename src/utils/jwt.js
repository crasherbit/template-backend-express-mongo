import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from './constants.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
};

/**
 * Sign a JWT with the configured secret.
 * Payload must include { userId, username, role }.
 * FUTURE (option C): also sign a refreshToken with longer expiry and store in DB for revocation.
 */
export const generateJwt = (payload) => jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });

/**
 * Verify a JWT and return the decoded payload.
 * Throws 401 if invalid or expired.
 * FUTURE (option C): also check a token blacklist/DB table for revoked tokens.
 */
export const verifyJwt = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    throw createHttpError.Unauthorized('Invalid or expired token');
  }
};
