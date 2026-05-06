import { createHash, randomBytes } from 'node:crypto';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';

const RECOVERY_CODE_COUNT = 8;
const JWT_EXPIRY = '7d';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
};

/**
 * Generate 8 one-time recovery codes.
 * Returns an array of { plain, hashed } objects.
 * Plain codes are shown to the user once; only hashed versions are stored.
 */
export const serviceGenerateRecoveryCodes = () => {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const segments = Array.from({ length: 3 }, () =>
      randomBytes(2).toString('hex').toUpperCase().slice(0, 4),
    );
    const plain = segments.join('-');
    const hashed = createHash('sha256').update(plain).digest('hex');
    return { plain, hashed };
  });
};

/**
 * Hash a recovery code for storage comparison.
 * Case-insensitive: normalises to uppercase before hashing.
 */
export const serviceHashRecoveryCode = (code) =>
  createHash('sha256').update(code.toUpperCase()).digest('hex');

/**
 * Verify a recovery code against a list of stored hashed codes.
 * Returns { matched: boolean, index: number }.
 */
export const serviceVerifyRecoveryCode = (code, recoveryCodes) => {
  const hashed = serviceHashRecoveryCode(code);
  const index = recoveryCodes.findIndex((rc) => !rc.used && rc.code === hashed);
  return { matched: index !== -1, index };
};

/**
 * Sign a JWT with the configured secret.
 * Payload must include { userId, username, role }.
 * FUTURE (option C): also sign a refreshToken with longer expiry and store in DB for revocation.
 */
export const serviceGenerateJwt = (payload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });

/**
 * Verify a JWT and return the decoded payload.
 * Throws 401 if invalid or expired.
 * FUTURE (option C): also check a token blacklist/DB table for revoked tokens.
 */
export const serviceVerifyJwt = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    throw createHttpError.Unauthorized('Invalid or expired token');
  }
};

/**
 * Generate a cryptographically random sessionId (64 hex chars) for challenge storage.
 */
export const serviceGenerateSessionId = () => randomBytes(32).toString('hex');

/**
 * Derive a human-readable passkey label from the User-Agent header.
 * Chrome UA contains "Safari" too, so Chrome must be checked first.
 */
export const serviceExtractLabel = (userAgent = '') => {
  if (!userAgent) return 'Unknown device';
  if (/iPhone|iPad/i.test(userAgent)) return 'iOS Device';
  if (/Android/i.test(userAgent)) return 'Android Device';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return 'Unknown device';
};

/**
 * Assert that a credential subdocument was found. Throws 404 otherwise.
 */
export const serviceAssertCredentialExists = (credential) => {
  if (!credential) throw createHttpError.NotFound('Passkey not found');
};

/**
 * Assert that the user has more than one credential before allowing deletion.
 * Throws 400 if deleting the last passkey.
 */
export const serviceAssertNotLastCredential = (credentials) => {
  if (credentials.length <= 1) {
    throw createHttpError.BadRequest('Cannot remove the last passkey');
  }
};
