import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import createHttpError from 'http-errors';
import express from 'express';
import { handler } from '../../../utils/handler.js';
import { getChallenge, setChallenge } from './challengeStore.js';
import {
  daoAddCredential,
  daoCreateUser,
  daoFindById,
  daoFindByUsername,
  daoMarkRecoveryCodeUsed,
  daoRemoveCredential,
  daoReplaceRecoveryCodes,
  daoUpdateCredentialCounter,
} from './dao.js';
import {
  serviceAssertCredentialExists,
  serviceAssertNotLastCredential,
  serviceExtractLabel,
  serviceGenerateJwt,
  serviceGenerateRecoveryCodes,
  serviceGenerateSessionId,
  serviceVerifyRecoveryCode,
} from './service.js';

export const auth = express.Router();

const COOKIE_NAME = 'authToken';
const COOKIE_OPTIONS = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  // FUTURE (option C): also issue a refresh token cookie with longer maxAge
  // and store its hash in DB for server-side revocation.
});

// ── Helpers ────────────────────────────────────────────────────────────────

const formatUser = (user) => ({
  username: user.username,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const formatPasskey = (cred) => ({
  id: cred._id.toString(),
  label: cred.label,
  createdAt: cred.createdAt,
});

/** Issue JWT cookie and return formatted user object. */
const issueSession = (res, user) => {
  const token = serviceGenerateJwt({
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS());
  return formatUser(user);
};

// ── Routes ─────────────────────────────────────────────────────────────────

auth.post('/register/begin', handler.public(registerBegin));
auth.post('/register/complete', handler.public(registerComplete));
auth.post('/login/begin', handler.public(loginBegin));
auth.post('/login/complete', handler.public(loginComplete));
auth.post('/recover', handler.public(recoverWithCode));
auth.get('/me', handler.authenticated({ cb: me }));
auth.post('/logout', handler.authenticated({ cb: logout, noContent: true }));
auth.post('/recovery-codes/regenerate/begin', handler.authenticated({ cb: regenBegin }));
auth.post('/recovery-codes/regenerate/complete', handler.authenticated({ cb: regenComplete }));
auth.post('/passkeys/begin', handler.authenticated({ cb: addPasskeyBegin }));
auth.post('/passkeys/complete', handler.authenticated({ cb: addPasskeyComplete }));
auth.get('/passkeys', handler.authenticated({ cb: listPasskeys }));
auth.delete('/passkeys/:id', handler.authenticated({ cb: deletePasskey }));

// ── Public handlers ────────────────────────────────────────────────────────

async function registerBegin(req) {
  // 1. Validate username
  const { username } = req.body;
  if (!username || !/^[a-zA-Z0-9._\-]{3,25}$/.test(username)) {
    throw createHttpError.BadRequest('Invalid username format');
  }

  // 2. Check uniqueness
  const existing = await daoFindByUsername(username);
  if (existing) throw createHttpError.Conflict('Username already taken');

  // 3. Generate WebAuthn registration options
  const options = await generateRegistrationOptions({
    rpName: process.env.WEBAUTHN_RP_NAME,
    rpID: process.env.WEBAUTHN_RP_ID,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  // 4. Store challenge
  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username });

  return { sessionId, options };
}

async function registerComplete(req, res) {
  const { sessionId, credential } = req.body;

  // 1. Retrieve and consume challenge
  const session = getChallenge(sessionId);
  if (!session) throw createHttpError.BadRequest('Invalid or expired session');

  // 2. Verify WebAuthn response
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN,
    expectedRPID: process.env.WEBAUTHN_RP_ID,
  });

  if (!verification.verified) throw createHttpError.BadRequest('WebAuthn verification failed');

  const { credential: cred } = verification.registrationInfo;

  // 3. Generate recovery codes (plaintext returned once, hashed stored)
  const codes = serviceGenerateRecoveryCodes();

  // 4. Create user
  const label = serviceExtractLabel(req.headers['user-agent']);
  const newUser = await daoCreateUser({
    username: session.username,
    credentials: [
      {
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey),
        counter: cred.counter,
        transports: credential.response?.transports ?? [],
        label,
      },
    ],
    recoveryCodes: codes.map(({ hashed }) => ({ code: hashed, used: false })),
  });

  // 5. Auto-login
  const user = issueSession(res, newUser);

  return { user, recoveryCodes: codes.map(({ plain }) => plain) };
}

async function loginBegin(req) {
  // 1. Find user (generic error to prevent enumeration)
  const { username } = req.body;
  const user = await daoFindByUsername(username);
  if (!user) throw createHttpError.BadRequest('Invalid credentials');

  // 2. Generate WebAuthn authentication options
  const options = await generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID,
    allowCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    userVerification: 'required',
  });

  // 3. Store challenge with username for lookup in complete step
  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username });

  return { sessionId, options };
}

async function loginComplete(req, res) {
  const { sessionId, credential } = req.body;

  // 1. Retrieve and consume challenge
  const session = getChallenge(sessionId);
  if (!session) throw createHttpError.BadRequest('Invalid or expired session');

  // 2. Find user and matching stored credential
  const user = await daoFindByUsername(session.username);
  if (!user) throw createHttpError.Unauthorized('Invalid credentials');

  const storedCred = user.credentials.find((c) => c.credentialId === credential?.id);
  if (!storedCred) throw createHttpError.Unauthorized('Invalid credentials');

  // 3. Verify WebAuthn assertion
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN,
    expectedRPID: process.env.WEBAUTHN_RP_ID,
    credential: {
      id: storedCred.credentialId,
      publicKey: storedCred.publicKey,
      counter: storedCred.counter,
      transports: storedCred.transports,
    },
  });

  if (!verification.verified) throw createHttpError.Unauthorized('Invalid credentials');

  // 4. Update counter (replay protection)
  await daoUpdateCredentialCounter(
    user._id,
    storedCred.credentialId,
    verification.authenticationInfo.newCounter,
  );

  // 5. Issue session
  const userData = issueSession(res, user);
  return { user: userData };
}

async function recoverWithCode(req, res) {
  const { username, code } = req.body;

  // 1. Find user (generic error)
  const user = await daoFindByUsername(username);
  if (!user) throw createHttpError.Unauthorized('Invalid credentials');

  // 2. Verify recovery code
  const { matched, index } = serviceVerifyRecoveryCode(code, user.recoveryCodes);
  if (!matched) throw createHttpError.Unauthorized('Invalid credentials');

  // 3. Burn used code
  await daoMarkRecoveryCodeUsed(user._id, index);

  // 4. Issue full session
  const userData = issueSession(res, user);
  return { user: userData };
}

// ── Authenticated handlers ─────────────────────────────────────────────────

async function me(req) {
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');
  return formatUser(user);
}

async function logout(_req, res) {
  res.clearCookie(COOKIE_NAME);
  // FUTURE (option C): invalidate refresh token in DB here before clearing cookies.
}

async function regenBegin(req) {
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');

  // Generate a WebAuthn challenge to confirm identity before regenerating
  const options = await generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID,
    allowCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    userVerification: 'required',
  });

  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username: user.username });

  return { sessionId, options };
}

async function regenComplete(req) {
  const { sessionId, credential } = req.body;

  // 1. Retrieve and consume challenge
  const session = getChallenge(sessionId);
  if (!session) throw createHttpError.BadRequest('Invalid or expired session');

  // 2. Look up authenticated user by JWT userId (not session username)
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');

  const storedCred = user.credentials.find((c) => c.credentialId === credential?.id);
  if (!storedCred) throw createHttpError.Unauthorized('Invalid credentials');

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN,
    expectedRPID: process.env.WEBAUTHN_RP_ID,
    credential: {
      id: storedCred.credentialId,
      publicKey: storedCred.publicKey,
      counter: storedCred.counter,
      transports: storedCred.transports,
    },
  });

  if (!verification.verified) throw createHttpError.Unauthorized('Invalid credentials');

  // 3. Regenerate recovery codes
  const codes = serviceGenerateRecoveryCodes();
  await daoReplaceRecoveryCodes(
    user._id,
    codes.map(({ hashed }) => ({ code: hashed, used: false })),
  );

  return { recoveryCodes: codes.map(({ plain }) => plain) };
}

async function addPasskeyBegin(req) {
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');

  const options = await generateRegistrationOptions({
    rpName: process.env.WEBAUTHN_RP_NAME,
    rpID: process.env.WEBAUTHN_RP_ID,
    userName: user.username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    // Exclude already-registered credentials to prevent duplicates
    excludeCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
  });

  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username: user.username });

  return { sessionId, options };
}

async function addPasskeyComplete(req) {
  const { sessionId, credential } = req.body;

  // 1. Retrieve and consume challenge
  const session = getChallenge(sessionId);
  if (!session) throw createHttpError.BadRequest('Invalid or expired session');

  // 2. Verify new credential
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN,
    expectedRPID: process.env.WEBAUTHN_RP_ID,
  });

  if (!verification.verified) throw createHttpError.BadRequest('WebAuthn verification failed');

  const { credential: cred } = verification.registrationInfo;

  // 3. Add new credential to user
  const label = serviceExtractLabel(req.headers['user-agent']);
  const updatedUser = await daoAddCredential(req.user.userId, {
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey),
    counter: cred.counter,
    transports: credential.response?.transports ?? [],
    label,
  });

  const newCred = updatedUser.credentials[updatedUser.credentials.length - 1];
  return formatPasskey(newCred);
}

async function listPasskeys(req) {
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');
  return user.credentials.map(formatPasskey);
}

async function deletePasskey(req) {
  const user = await daoFindById(req.user.userId);
  if (!user) throw createHttpError.NotFound('User not found');

  // 1. Find the credential subdocument
  const credential = user.credentials.id(req.params.id);
  serviceAssertCredentialExists(credential);

  // 2. Block deletion of last passkey
  serviceAssertNotLastCredential(user.credentials);

  // 3. Remove
  await daoRemoveCredential(user._id, req.params.id);

  return formatPasskey(credential);
}

export const _testable = {
  registerBegin,
  registerComplete,
  loginBegin,
  loginComplete,
  recoverWithCode,
  me,
  logout,
  regenBegin,
  regenComplete,
  addPasskeyBegin,
  addPasskeyComplete,
  listPasskeys,
  deletePasskey,
};
