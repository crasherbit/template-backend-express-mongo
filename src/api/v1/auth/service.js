import { createHash, randomBytes } from 'node:crypto';
import createHttpError from 'http-errors';
import { AUTH_COOKIE_NAME, USERNAME_REGEX } from '../../../utils/constants.js';
import { generateJwt, verifyJwt } from '../../../utils/jwt.js';

const RECOVERY_CODE_COUNT = 8;

// ── Re-exports ────────────────────────────────────────────────────────────────
// JWT utilities live in src/utils/jwt.js; re-exported here under the service-
// prefix so feature-layer callers import from a single module.
export const serviceGenerateJwt = generateJwt;
export const serviceVerifyJwt = verifyJwt;

// ── Cookie helpers ────────────────────────────────────────────────────────────

export const serviceGetCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — keep aligned with JWT_EXPIRY in constants.js
  // FUTURE (option C): also issue a refresh token cookie with longer maxAge
  // and store its hash in DB for server-side revocation.
});

/** Issue JWT cookie and return formatted user object. */
export const serviceIssueSession = (res, user) => {
  const token = generateJwt({
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
  });
  res.cookie(AUTH_COOKIE_NAME, token, serviceGetCookieOptions());
  return serviceFormatUser(user);
};

/** Clear the auth session cookie. */
export const serviceClearSession = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, serviceGetCookieOptions());
};

// ── Format helpers ────────────────────────────────────────────────────────────

export const serviceFormatUser = (user) => ({
  username: user.username,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const serviceFormatPasskey = (cred) => ({
  id: cred._id.toString(),
  label: cred.label,
  createdAt: cred.createdAt,
});

// ── Build helpers ─────────────────────────────────────────────────────────────

/** Map a verified WebAuthn credential into the DB storage shape. */
export const serviceBuildCredentialPayload = (cred, credential, label) => ({
  credentialId: cred.id,
  publicKey: Buffer.from(cred.publicKey),
  counter: cred.counter,
  transports: credential.response?.transports ?? [],
  label,
});

/** Map plaintext recovery codes to the hashed storage shape. */
export const serviceBuildRecoveryCodeStorage = (codes) =>
  codes.map(({ hashed }) => ({ code: hashed, used: false }));

// ── Recovery codes ────────────────────────────────────────────────────────────

/**
 * Generate RECOVERY_CODE_COUNT one-time recovery codes.
 * Returns an array of { plain, hashed } objects.
 * Plain codes are shown to the user once; only hashed versions are stored.
 */
export const serviceGenerateRecoveryCodes = () =>
  Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const segments = Array.from({ length: 3 }, () =>
      randomBytes(2).toString('hex').toUpperCase().slice(0, 4),
    );
    const plain = segments.join('-');
    const hashed = createHash('sha256').update(plain).digest('hex');
    return { plain, hashed };
  });

/**
 * Hash a recovery code for storage comparison.
 * Case-insensitive: normalises to uppercase before hashing.
 * Returns empty string for null/undefined input (produces a non-matching hash).
 */
export const serviceHashRecoveryCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
};

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

// ── Assertions ────────────────────────────────────────────────────────────────

/** Assert that the username matches the allowed format. Throws 400 otherwise. */
export const serviceAssertValidUsername = (username) => {
  if (!username || !USERNAME_REGEX.test(username)) {
    throw createHttpError.BadRequest('Invalid username format');
  }
};

/** Assert username is not already taken. Throws 409 if existing user found. */
export const serviceAssertUsernameAvailable = (existing) => {
  if (existing) throw createHttpError.Conflict('Username already taken');
};

/** Assert that a WebAuthn session exists and has not expired. Throws 400 otherwise. */
export const serviceAssertSessionValid = (session) => {
  if (!session) throw createHttpError.BadRequest('Invalid or expired session');
};

/**
 * Assert user exists in a login begin flow.
 * Uses 400 (not 404) to prevent username enumeration.
 */
export const serviceAssertLoginUserExists = (user) => {
  if (!user) throw createHttpError.BadRequest('Invalid credentials');
};

/**
 * Assert user was found in a login complete / recover flow.
 * Uses 401 generic error to prevent username enumeration.
 */
export const serviceAssertLoginCredentials = (user) => {
  if (!user) throw createHttpError.Unauthorized('Invalid credentials');
};

/** Assert that a matching stored credential was found. Throws 401 otherwise. */
export const serviceAssertStoredCredential = (storedCred) => {
  if (!storedCred) throw createHttpError.Unauthorized('Invalid credentials');
};

/**
 * Assert WebAuthn registration verification succeeded and registrationInfo is present.
 * Throws 400 otherwise.
 */
export const serviceAssertRegistrationVerified = (verification) => {
  if (!verification.verified || !verification.registrationInfo) {
    throw createHttpError.BadRequest('WebAuthn verification failed');
  }
};

/**
 * Assert WebAuthn authentication verification succeeded and authenticationInfo is present.
 * Throws 401 otherwise.
 */
export const serviceAssertAuthenticationVerified = (verification) => {
  if (!verification.verified || !verification.authenticationInfo) {
    throw createHttpError.Unauthorized('Invalid credentials');
  }
};

/** Assert that a recovery code matched. Throws 401 otherwise. */
export const serviceAssertRecoveryCodeValid = (matched) => {
  if (!matched) throw createHttpError.Unauthorized('Invalid credentials');
};

/** Assert that a user was found for an authenticated endpoint. Throws 404 otherwise. */
export const serviceAssertUserFound = (user) => {
  if (!user) throw createHttpError.NotFound('User not found');
};

/** Assert that a credential subdocument was found. Throws 404 otherwise. */
export const serviceAssertCredentialExists = (credential) => {
  if (!credential) throw createHttpError.NotFound('Passkey not found');
};

/** Assert the user has more than one credential before allowing deletion. Throws 400 otherwise. */
export const serviceAssertNotLastCredential = (credentials) => {
  if (credentials.length <= 1) {
    throw createHttpError.BadRequest('Cannot remove the last passkey');
  }
};
