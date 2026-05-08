import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import express from 'express';
import { AUTH_COOKIE_NAME } from '../../../utils/constants.js';
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
  serviceBuildCredentialPayload,
  serviceBuildRecoveryCodeStorage,
  serviceAssertAuthenticationVerified,
  serviceAssertCredentialExists,
  serviceAssertLoginCredentials,
  serviceAssertLoginUserExists,
  serviceAssertNotLastCredential,
  serviceAssertRecoveryCodeValid,
  serviceAssertRegistrationVerified,
  serviceAssertSessionValid,
  serviceAssertStoredCredential,
  serviceAssertUsernameAvailable,
  serviceAssertUserFound,
  serviceAssertValidUsername,
  serviceClearSession,
  serviceExtractLabel,
  serviceFormatPasskey,
  serviceFormatUser,
  serviceGenerateRecoveryCodes,
  serviceGenerateSessionId,
  serviceIssueSession,
  serviceVerifyRecoveryCode,
} from './service.js';

export const auth = express.Router();

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
  const { username } = req.body;
  serviceAssertValidUsername(username);

  const existing = await daoFindByUsername(username);
  serviceAssertUsernameAvailable(existing);

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

  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username });
  return { sessionId, options };
}

async function registerComplete(req, res) {
  const { sessionId, credential } = req.body;

  const session = getChallenge(sessionId);
  serviceAssertSessionValid(session);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: [process.env.WEBAUTHN_ORIGIN, process.env.WEBAUTHN_ANDROID_ORIGIN].filter(Boolean),
    expectedRPID: process.env.WEBAUTHN_RP_ID,
  });
  serviceAssertRegistrationVerified(verification);

  const { credential: cred } = verification.registrationInfo;
  const codes = serviceGenerateRecoveryCodes();
  const label = serviceExtractLabel(req.headers['user-agent']);
  const newUser = await daoCreateUser({
    username: session.username,
    credentials: [serviceBuildCredentialPayload(cred, credential, label)],
    recoveryCodes: serviceBuildRecoveryCodeStorage(codes),
  });

  const user = serviceIssueSession(res, newUser);
  return { user, recoveryCodes: codes.map(({ plain }) => plain) };
}

async function loginBegin(req) {
  const { username } = req.body;
  const user = await daoFindByUsername(username);
  serviceAssertLoginUserExists(user);

  const options = await generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID,
    allowCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    userVerification: 'required',
  });

  const sessionId = serviceGenerateSessionId();
  setChallenge(sessionId, { challenge: options.challenge, username });
  return { sessionId, options };
}

async function loginComplete(req, res) {
  const { sessionId, credential } = req.body;

  const session = getChallenge(sessionId);
  serviceAssertSessionValid(session);

  const user = await daoFindByUsername(session.username);
  serviceAssertLoginCredentials(user);

  const storedCred = user.credentials.find((c) => c.credentialId === credential?.id);
  serviceAssertStoredCredential(storedCred);

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: [process.env.WEBAUTHN_ORIGIN, process.env.WEBAUTHN_ANDROID_ORIGIN].filter(Boolean),
    expectedRPID: process.env.WEBAUTHN_RP_ID,
    credential: {
      id: storedCred.credentialId,
      publicKey: storedCred.publicKey,
      counter: storedCred.counter,
      transports: storedCred.transports,
    },
  });
  serviceAssertAuthenticationVerified(verification);

  await daoUpdateCredentialCounter(
    user._id,
    storedCred.credentialId,
    verification.authenticationInfo.newCounter,
  );

  const userData = serviceIssueSession(res, user);
  return { user: userData };
}

async function recoverWithCode(req, res) {
  const { username, code } = req.body;

  const user = await daoFindByUsername(username);
  serviceAssertLoginCredentials(user);

  const { matched, index } = serviceVerifyRecoveryCode(code, user.recoveryCodes);
  serviceAssertRecoveryCodeValid(matched);

  await daoMarkRecoveryCodeUsed(user._id, index);

  const userData = serviceIssueSession(res, user);
  return { user: userData };
}

// ── Authenticated handlers ─────────────────────────────────────────────────

async function me(req) {
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);
  return serviceFormatUser(user);
}

async function logout(_req, res) {
  serviceClearSession(res);
  // FUTURE (option C): invalidate refresh token in DB here before clearing cookies.
}

async function regenBegin(req) {
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);

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

  const session = getChallenge(sessionId);
  serviceAssertSessionValid(session);

  // Look up authenticated user by JWT userId (not session username)
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);

  const storedCred = user.credentials.find((c) => c.credentialId === credential?.id);
  serviceAssertStoredCredential(storedCred);

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: [process.env.WEBAUTHN_ORIGIN, process.env.WEBAUTHN_ANDROID_ORIGIN].filter(Boolean),
    expectedRPID: process.env.WEBAUTHN_RP_ID,
    credential: {
      id: storedCred.credentialId,
      publicKey: storedCred.publicKey,
      counter: storedCred.counter,
      transports: storedCred.transports,
    },
  });
  serviceAssertAuthenticationVerified(verification);

  const codes = serviceGenerateRecoveryCodes();
  await daoReplaceRecoveryCodes(user._id, serviceBuildRecoveryCodeStorage(codes));
  return { recoveryCodes: codes.map(({ plain }) => plain) };
}

async function addPasskeyBegin(req) {
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);

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

  const session = getChallenge(sessionId);
  serviceAssertSessionValid(session);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: session.challenge,
    expectedOrigin: [process.env.WEBAUTHN_ORIGIN, process.env.WEBAUTHN_ANDROID_ORIGIN].filter(Boolean),
    expectedRPID: process.env.WEBAUTHN_RP_ID,
  });
  serviceAssertRegistrationVerified(verification);

  const { credential: cred } = verification.registrationInfo;
  const label = serviceExtractLabel(req.headers['user-agent']);
  const updatedUser = await daoAddCredential(
    req.user.userId,
    serviceBuildCredentialPayload(cred, credential, label),
  );

  // Find the new credential by credentialId (not by array position)
  const newCred = updatedUser.credentials.find((c) => c.credentialId === cred.id);
  return serviceFormatPasskey(newCred);
}

async function listPasskeys(req) {
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);
  return user.credentials.map(serviceFormatPasskey);
}

async function deletePasskey(req) {
  const user = await daoFindById(req.user.userId);
  serviceAssertUserFound(user);

  const credential = user.credentials.id(req.params.id);
  serviceAssertCredentialExists(credential);
  serviceAssertNotLastCredential(user.credentials);

  await daoRemoveCredential(user._id, req.params.id);
  return serviceFormatPasskey(credential);
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
