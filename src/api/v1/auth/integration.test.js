import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import supertest from 'supertest';

// ── Mock WebAuthn BEFORE the module graph loads the controller ────────────
// @simplewebauthn/server requires a real browser ceremony; we mock the
// verify/generate functions so tests can exercise the business logic only.
mock.module('@simplewebauthn/server', {
  namedExports: {
    generateRegistrationOptions: mock.fn(),
    verifyRegistrationResponse: mock.fn(),
    generateAuthenticationOptions: mock.fn(),
    verifyAuthenticationResponse: mock.fn(),
  },
});

// Dynamic imports AFTER mocks are in place
const { app, startServer, stopServer } = await import('../../../../config/testServer.js');
const webauthn = await import('@simplewebauthn/server');

// ── Default mock implementations ─────────────────────────────────────────

const MOCK_CHALLENGE = 'bW9jay1jaGFsbGVuZ2UtYmFzZTY0dXJs';
const MOCK_CREDENTIAL_ID = 'mock-credential-id-base64url';
const MOCK_PUBLIC_KEY = new Uint8Array([1, 2, 3, 4, 5]);

const setupDefaultMocks = () => {
  webauthn.generateRegistrationOptions.mock.mockImplementation(async () => ({
    challenge: MOCK_CHALLENGE,
    rp: { name: 'Test', id: 'localhost' },
    user: { name: 'testuser', displayName: 'testuser', id: 'dGVzdA' },
    pubKeyCredParams: [],
    timeout: 60000,
    attestation: 'none',
  }));

  webauthn.verifyRegistrationResponse.mock.mockImplementation(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: MOCK_CREDENTIAL_ID,
        publicKey: MOCK_PUBLIC_KEY,
        counter: 0,
        transports: ['internal'],
      },
    },
  }));

  webauthn.generateAuthenticationOptions.mock.mockImplementation(async () => ({
    challenge: MOCK_CHALLENGE,
    rpId: 'localhost',
    allowCredentials: [],
    timeout: 60000,
  }));

  webauthn.verifyAuthenticationResponse.mock.mockImplementation(async () => ({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  }));
};

// ── Test helpers ──────────────────────────────────────────────────────────

/**
 * Register a user via the API and return { cookie, recoveryCodes, username }.
 */
const registerUser = async (request, username = 'testuser') => {
  const beginRes = await request
    .post('/api/v1/auth/register/begin')
    .send({ username });
  assert.equal(beginRes.status, 200, `register/begin failed: ${JSON.stringify(beginRes.body)}`);

  const { sessionId } = beginRes.body.payload;

  const completeRes = await request
    .post('/api/v1/auth/register/complete')
    .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: { transports: ['internal'] } } });
  assert.equal(completeRes.status, 200, `register/complete failed: ${JSON.stringify(completeRes.body)}`);

  const cookie = completeRes.headers['set-cookie']?.[0];
  const { recoveryCodes } = completeRes.body.payload;
  return { cookie, recoveryCodes, username };
};

/**
 * Login a user via the API and return the Set-Cookie header value.
 */
const loginUser = async (request, username) => {
  const beginRes = await request
    .post('/api/v1/auth/login/begin')
    .send({ username });
  assert.equal(beginRes.status, 200);

  const { sessionId } = beginRes.body.payload;

  const completeRes = await request
    .post('/api/v1/auth/login/complete')
    .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });
  assert.equal(completeRes.status, 200);

  return completeRes.headers['set-cookie']?.[0];
};

// ── Suite setup ───────────────────────────────────────────────────────────

let request;

describe('Auth API — Integration', () => {
  before(async () => {
    await startServer();
    request = supertest(app);
  });

  after(async () => {
    await stopServer();
  });

  beforeEach(() => {
    setupDefaultMocks();
  });

  // ── POST /auth/register/begin ──────────────────────────────────────────

  describe('POST /api/v1/auth/register/begin', () => {
    test('should return sessionId and WebAuthn options for a new username', async () => {
      const res = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'newuser_begin' });

      assert.equal(res.status, 200);
      assert.ok(res.body.payload.sessionId, 'should include sessionId');
      assert.ok(res.body.payload.options, 'should include options');
    });

    test('should return 409 if username is already taken', async () => {
      await registerUser(request, 'taken_user');

      const res = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'taken_user' });

      assert.equal(res.status, 409);
    });

    test('should return 400 for an invalid username (too short)', async () => {
      const res = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'ab' });

      assert.equal(res.status, 400);
    });

    test('should return 400 for an invalid username (special characters)', async () => {
      const res = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'user name!' });

      assert.equal(res.status, 400);
    });

    test('should return 400 if username is missing', async () => {
      const res = await request
        .post('/api/v1/auth/register/begin')
        .send({});

      assert.equal(res.status, 400);
    });
  });

  // ── POST /auth/register/complete ──────────────────────────────────────

  describe('POST /api/v1/auth/register/complete', () => {
    test('should create user, set authToken cookie and return user + recovery codes', async () => {
      const beginRes = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'complete_user' });
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/register/complete')
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: { transports: ['internal'] } } });

      assert.equal(res.status, 200);
      assert.ok(res.body.payload.user, 'should include user');
      assert.equal(res.body.payload.user.username, 'complete_user');
      assert.equal(res.body.payload.user.role, 'user');
      assert.ok(Array.isArray(res.body.payload.recoveryCodes), 'should include recoveryCodes');
      assert.equal(res.body.payload.recoveryCodes.length, 8);
      assert.ok(
        res.headers['set-cookie']?.some((c) => c.startsWith('authToken=')),
        'should set authToken cookie',
      );
    });

    test('should return 400 for an invalid or expired sessionId', async () => {
      const res = await request
        .post('/api/v1/auth/register/complete')
        .send({ sessionId: 'nonexistent-session', credential: {} });

      assert.equal(res.status, 400);
    });

    test('should return 400 if WebAuthn verification fails', async () => {
      webauthn.verifyRegistrationResponse.mock.mockImplementationOnce(async () => ({
        verified: false,
      }));

      const beginRes = await request
        .post('/api/v1/auth/register/begin')
        .send({ username: 'fail_verify_user' });
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/register/complete')
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });

      assert.equal(res.status, 400);
    });
  });

  // ── POST /auth/login/begin ────────────────────────────────────────────

  describe('POST /api/v1/auth/login/begin', () => {
    test('should return sessionId and options for an existing user', async () => {
      await registerUser(request, 'login_begin_user');

      const res = await request
        .post('/api/v1/auth/login/begin')
        .send({ username: 'login_begin_user' });

      assert.equal(res.status, 200);
      assert.ok(res.body.payload.sessionId);
      assert.ok(res.body.payload.options);
    });

    test('should return 400 with a generic error for a non-existent username', async () => {
      const res = await request
        .post('/api/v1/auth/login/begin')
        .send({ username: 'does_not_exist_xyz' });

      assert.equal(res.status, 400);
      // Generic message — must not reveal whether user exists
      assert.ok(!res.body.message?.toLowerCase().includes('not found'));
    });
  });

  // ── POST /auth/login/complete ─────────────────────────────────────────

  describe('POST /api/v1/auth/login/complete', () => {
    test('should set authToken cookie and return user data', async () => {
      await registerUser(request, 'login_complete_user');

      const beginRes = await request
        .post('/api/v1/auth/login/begin')
        .send({ username: 'login_complete_user' });
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/login/complete')
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });

      assert.equal(res.status, 200);
      assert.equal(res.body.payload.user.username, 'login_complete_user');
      assert.ok(res.headers['set-cookie']?.some((c) => c.startsWith('authToken=')));
    });

    test('should return 400 for an invalid sessionId', async () => {
      const res = await request
        .post('/api/v1/auth/login/complete')
        .send({ sessionId: 'invalid', credential: { id: MOCK_CREDENTIAL_ID } });

      assert.equal(res.status, 400);
    });

    test('should return 401 if WebAuthn verification fails', async () => {
      webauthn.verifyAuthenticationResponse.mock.mockImplementationOnce(async () => ({
        verified: false,
        authenticationInfo: {},
      }));

      await registerUser(request, 'login_fail_verify');

      const beginRes = await request
        .post('/api/v1/auth/login/begin')
        .send({ username: 'login_fail_verify' });
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/login/complete')
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });

      assert.equal(res.status, 401);
    });

    test('should return 401 if credential id does not match any stored credential', async () => {
      await registerUser(request, 'login_wrong_cred');

      const beginRes = await request
        .post('/api/v1/auth/login/begin')
        .send({ username: 'login_wrong_cred' });
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/login/complete')
        .send({ sessionId, credential: { id: 'wrong-credential-id' } });

      assert.equal(res.status, 401);
    });
  });

  // ── POST /auth/recover ────────────────────────────────────────────────

  describe('POST /api/v1/auth/recover', () => {
    test('should set authToken cookie and return user when recovery code is valid', async () => {
      const { recoveryCodes, username } = await registerUser(request, 'recover_user');

      const res = await request
        .post('/api/v1/auth/recover')
        .send({ username, code: recoveryCodes[0] });

      assert.equal(res.status, 200);
      assert.equal(res.body.payload.user.username, username);
      assert.ok(res.headers['set-cookie']?.some((c) => c.startsWith('authToken=')));
    });

    test('should return 401 for an invalid recovery code', async () => {
      await registerUser(request, 'recover_invalid_user');

      const res = await request
        .post('/api/v1/auth/recover')
        .send({ username: 'recover_invalid_user', code: 'XXXX-XXXX-XXXX' });

      assert.equal(res.status, 401);
    });

    test('should return 401 if the recovery code has already been used', async () => {
      const { recoveryCodes, username } = await registerUser(request, 'recover_used_user');
      const code = recoveryCodes[1];

      // First use — should succeed
      await request.post('/api/v1/auth/recover').send({ username, code });

      // Second use — should fail
      const res = await request
        .post('/api/v1/auth/recover')
        .send({ username, code });

      assert.equal(res.status, 401);
    });

    test('should return 401 if code is missing', async () => {
      await registerUser(request, 'recover_missing_code');

      const res = await request
        .post('/api/v1/auth/recover')
        .send({ username: 'recover_missing_code' });

      assert.equal(res.status, 401);
    });
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    test('should return current user data from DB', async () => {
      const { cookie, username } = await registerUser(request, 'me_user');

      const res = await request
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.payload.username, username);
      assert.ok(res.body.payload.role);
      assert.ok(res.body.payload.createdAt);
    });

    test('should return 401 without a cookie', async () => {
      const res = await request.get('/api/v1/auth/me');
      assert.equal(res.status, 401);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    test('should clear the authToken cookie and return 204', async () => {
      const { cookie } = await registerUser(request, 'logout_user');

      const res = await request
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);

      assert.equal(res.status, 204);
      const setCookie = res.headers['set-cookie'] ?? [];
      assert.ok(
        setCookie.some((c) => c.includes('authToken=;')),
        'should clear the cookie',
      );
    });

    test('should return 401 without a cookie', async () => {
      const res = await request.post('/api/v1/auth/logout');
      assert.equal(res.status, 401);
    });
  });

  // ── GET /auth/passkeys ────────────────────────────────────────────────

  describe('GET /api/v1/auth/passkeys', () => {
    test('should return the list of passkeys for the authenticated user', async () => {
      const { cookie } = await registerUser(request, 'passkeys_list_user');

      const res = await request
        .get('/api/v1/auth/passkeys')
        .set('Cookie', cookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.payload));
      assert.equal(res.body.payload.length, 1);
      assert.ok(res.body.payload[0].id, 'passkey should have an id');
      assert.ok(res.body.payload[0].label, 'passkey should have a label');
      assert.ok(res.body.payload[0].createdAt, 'passkey should have createdAt');
    });

    test('should return 401 without a cookie', async () => {
      const res = await request.get('/api/v1/auth/passkeys');
      assert.equal(res.status, 401);
    });
  });

  // ── POST /auth/passkeys/begin + complete ──────────────────────────────

  describe('POST /api/v1/auth/passkeys/begin + complete', () => {
    test('should add a new passkey to the authenticated user', async () => {
      const { cookie } = await registerUser(request, 'add_passkey_user');

      const beginRes = await request
        .post('/api/v1/auth/passkeys/begin')
        .set('Cookie', cookie);

      assert.equal(beginRes.status, 200);
      assert.ok(beginRes.body.payload.sessionId);

      const { sessionId } = beginRes.body.payload;

      const completeRes = await request
        .post('/api/v1/auth/passkeys/complete')
        .set('Cookie', cookie)
        .send({ sessionId, credential: { id: 'new-cred-id', response: { transports: ['usb'] } } });

      assert.equal(completeRes.status, 200);
      assert.ok(completeRes.body.payload.id, 'should return the new passkey id');

      // Verify the list now has 2 passkeys
      const listRes = await request
        .get('/api/v1/auth/passkeys')
        .set('Cookie', cookie);
      assert.equal(listRes.body.payload.length, 2);
    });

    test('should return 400 for an invalid sessionId in passkeys/complete', async () => {
      const { cookie } = await registerUser(request, 'add_passkey_bad_session');

      const res = await request
        .post('/api/v1/auth/passkeys/complete')
        .set('Cookie', cookie)
        .send({ sessionId: 'invalid-session', credential: { id: 'some-id' } });

      assert.equal(res.status, 400);
    });

    test('should return 400 if WebAuthn verification fails in passkeys/complete', async () => {
      // Register first with default mocks, then override for passkeys/complete only
      const { cookie } = await registerUser(request, 'add_passkey_fail_verify');

      const beginRes = await request
        .post('/api/v1/auth/passkeys/begin')
        .set('Cookie', cookie);
      const { sessionId } = beginRes.body.payload;

      webauthn.verifyRegistrationResponse.mock.mockImplementationOnce(async () => ({
        verified: false,
      }));

      const res = await request
        .post('/api/v1/auth/passkeys/complete')
        .set('Cookie', cookie)
        .send({ sessionId, credential: { id: 'new-id', response: {} } });

      assert.equal(res.status, 400);
    });
  });

  // ── DELETE /auth/passkeys/:id ──────────────────────────────────────────

  describe('DELETE /api/v1/auth/passkeys/:id', () => {
    test('should delete a passkey when more than one exists', async () => {
      const { cookie } = await registerUser(request, 'delete_passkey_user');

      // Add a second passkey first
      const beginRes = await request
        .post('/api/v1/auth/passkeys/begin')
        .set('Cookie', cookie);
      const { sessionId } = beginRes.body.payload;
      await request
        .post('/api/v1/auth/passkeys/complete')
        .set('Cookie', cookie)
        .send({ sessionId, credential: { id: 'second-cred-id', response: { transports: [] } } });

      // Get the list and delete the first one
      const listRes = await request.get('/api/v1/auth/passkeys').set('Cookie', cookie);
      const firstId = listRes.body.payload[0].id;

      const res = await request
        .delete(`/api/v1/auth/passkeys/${firstId}`)
        .set('Cookie', cookie);

      assert.equal(res.status, 200);

      // List should now have 1
      const newList = await request.get('/api/v1/auth/passkeys').set('Cookie', cookie);
      assert.equal(newList.body.payload.length, 1);
    });

    test('should return 400 when trying to delete the last passkey', async () => {
      const { cookie } = await registerUser(request, 'last_passkey_user');

      const listRes = await request.get('/api/v1/auth/passkeys').set('Cookie', cookie);
      const lastId = listRes.body.payload[0].id;

      const res = await request
        .delete(`/api/v1/auth/passkeys/${lastId}`)
        .set('Cookie', cookie);

      assert.equal(res.status, 400);
    });

    test('should return 404 for a non-existent passkey id', async () => {
      const { cookie } = await registerUser(request, 'delete_404_user');

      const res = await request
        .delete('/api/v1/auth/passkeys/000000000000000000000001')
        .set('Cookie', cookie);

      assert.equal(res.status, 404);
    });

    test('should return 404 for a non-ObjectId passkey id (in-memory lookup, no CastError)', async () => {
      const { cookie } = await registerUser(request, 'delete_invalid_id');

      const res = await request
        .delete('/api/v1/auth/passkeys/not-an-objectid')
        .set('Cookie', cookie);

      // credentials.id() is an in-memory string comparison — returns null, not a CastError
      assert.equal(res.status, 404);
    });

    test('should return 401 without a cookie', async () => {
      const res = await request.delete('/api/v1/auth/passkeys/000000000000000000000001');
      assert.equal(res.status, 401);
    });
  });

  // ── POST /auth/recovery-codes/regenerate/begin + complete ────────────

  describe('POST /api/v1/auth/recovery-codes/regenerate/begin + complete', () => {
    test('should return new recovery codes after passkey re-authentication', async () => {
      const { cookie, recoveryCodes: oldCodes } = await registerUser(
        request,
        'regen_codes_user',
      );

      const beginRes = await request
        .post('/api/v1/auth/recovery-codes/regenerate/begin')
        .set('Cookie', cookie);

      assert.equal(beginRes.status, 200);
      assert.ok(beginRes.body.payload.sessionId);

      const { sessionId } = beginRes.body.payload;

      const completeRes = await request
        .post('/api/v1/auth/recovery-codes/regenerate/complete')
        .set('Cookie', cookie)
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });

      assert.equal(completeRes.status, 200);
      const { recoveryCodes: newCodes } = completeRes.body.payload;
      assert.ok(Array.isArray(newCodes));
      assert.equal(newCodes.length, 8);
      // New codes should differ from the old ones
      assert.ok(!newCodes.some((c) => oldCodes.includes(c)), 'new codes must be different');
    });

    test('should return 400 for an invalid sessionId in regen/complete', async () => {
      const { cookie } = await registerUser(request, 'regen_bad_session');

      const res = await request
        .post('/api/v1/auth/recovery-codes/regenerate/complete')
        .set('Cookie', cookie)
        .send({ sessionId: 'invalid', credential: { id: MOCK_CREDENTIAL_ID } });

      assert.equal(res.status, 400);
    });

    test('should return 401 if WebAuthn verification fails in regen/complete', async () => {
      webauthn.verifyAuthenticationResponse.mock.mockImplementationOnce(async () => ({
        verified: false,
        authenticationInfo: {},
      }));

      const { cookie } = await registerUser(request, 'regen_fail_verify');

      const beginRes = await request
        .post('/api/v1/auth/recovery-codes/regenerate/begin')
        .set('Cookie', cookie);
      const { sessionId } = beginRes.body.payload;

      const res = await request
        .post('/api/v1/auth/recovery-codes/regenerate/complete')
        .set('Cookie', cookie)
        .send({ sessionId, credential: { id: MOCK_CREDENTIAL_ID, response: {} } });

      assert.equal(res.status, 401);
    });

    test('should return 401 without a cookie', async () => {
      const res = await request.post('/api/v1/auth/recovery-codes/regenerate/begin');
      assert.equal(res.status, 401);
    });
  });
});
