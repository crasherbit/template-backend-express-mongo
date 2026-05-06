import { strict as assert } from 'node:assert';
import { describe, mock, test } from 'node:test';

process.env.JWT_SECRET = 'test-unit-secret';

import {
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
  serviceBuildCredentialPayload,
  serviceBuildRecoveryCodeStorage,
  serviceClearSession,
  serviceExtractLabel,
  serviceFormatPasskey,
  serviceFormatUser,
  serviceGenerateJwt,
  serviceGenerateRecoveryCodes,
  serviceGenerateSessionId,
  serviceGetCookieOptions,
  serviceHashRecoveryCode,
  serviceIssueSession,
  serviceVerifyJwt,
  serviceVerifyRecoveryCode,
} from './service.js';

// ── serviceGenerateRecoveryCodes ─────────────────────────────────────────────

describe('serviceGenerateRecoveryCodes', () => {
  test('should return exactly 8 codes', () => {
    const codes = serviceGenerateRecoveryCodes();
    assert.equal(codes.length, 8);
  });

  test('each entry should have a plain and hashed value', () => {
    for (const { plain, hashed } of serviceGenerateRecoveryCodes()) {
      assert.ok(plain, 'plain should be defined');
      assert.ok(hashed, 'hashed should be defined');
      assert.notEqual(plain, hashed);
    }
  });

  test('plain codes should match format XXXX-XXXX-XXXX (uppercase alphanumeric)', () => {
    for (const { plain } of serviceGenerateRecoveryCodes()) {
      assert.match(plain, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  test('all 8 plain codes should be unique', () => {
    const plains = serviceGenerateRecoveryCodes().map((c) => c.plain);
    assert.equal(new Set(plains).size, 8);
  });
});

// ── serviceHashRecoveryCode ──────────────────────────────────────────────────

describe('serviceHashRecoveryCode', () => {
  test('should return the same hash for the same input', () => {
    assert.equal(
      serviceHashRecoveryCode('ABCD-EFGH-IJKL'),
      serviceHashRecoveryCode('ABCD-EFGH-IJKL'),
    );
  });

  test('should return different hashes for different inputs', () => {
    assert.notEqual(
      serviceHashRecoveryCode('ABCD-EFGH-IJKL'),
      serviceHashRecoveryCode('ABCD-EFGH-IJKM'),
    );
  });

  test('should be case-insensitive (normalises to uppercase)', () => {
    assert.equal(
      serviceHashRecoveryCode('abcd-efgh-ijkl'),
      serviceHashRecoveryCode('ABCD-EFGH-IJKL'),
    );
  });

  test('should return empty string for null input', () => {
    assert.equal(serviceHashRecoveryCode(null), '');
  });

  test('should return empty string for undefined input', () => {
    assert.equal(serviceHashRecoveryCode(undefined), '');
  });
});

// ── serviceVerifyRecoveryCode ────────────────────────────────────────────────

describe('serviceVerifyRecoveryCode', () => {
  test('should return matched=true with correct index when code is valid', () => {
    const codes = serviceGenerateRecoveryCodes();
    const stored = codes.map(({ hashed }) => ({ code: hashed, used: false }));
    const result = serviceVerifyRecoveryCode(codes[3].plain, stored);
    assert.equal(result.matched, true);
    assert.equal(result.index, 3);
  });

  test('should return matched=false for a wrong code', () => {
    const codes = serviceGenerateRecoveryCodes();
    const stored = codes.map(({ hashed }) => ({ code: hashed, used: false }));
    assert.equal(serviceVerifyRecoveryCode('WRONG-CODE-BAD', stored).matched, false);
  });

  test('should return matched=false for an already-used code', () => {
    const codes = serviceGenerateRecoveryCodes();
    const stored = codes.map(({ hashed }, i) => ({ code: hashed, used: i === 0 }));
    assert.equal(serviceVerifyRecoveryCode(codes[0].plain, stored).matched, false);
  });

  test('should return matched=false for undefined code (no crash)', () => {
    const codes = serviceGenerateRecoveryCodes();
    const stored = codes.map(({ hashed }) => ({ code: hashed, used: false }));
    assert.equal(serviceVerifyRecoveryCode(undefined, stored).matched, false);
  });
});

// ── serviceGenerateJwt / serviceVerifyJwt ────────────────────────────────────

describe('serviceGenerateJwt', () => {
  test('should generate a string token', () => {
    const token = serviceGenerateJwt({ userId: 'u1', username: 'alice', role: 'user' });
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);
  });
});

describe('serviceVerifyJwt', () => {
  test('should return the original payload', () => {
    const payload = { userId: 'u1', username: 'alice', role: 'user' };
    const token = serviceGenerateJwt(payload);
    const decoded = serviceVerifyJwt(token);
    assert.equal(decoded.userId, 'u1');
    assert.equal(decoded.username, 'alice');
    assert.equal(decoded.role, 'user');
  });

  test('should throw 401 for an invalid token', () => {
    assert.throws(
      () => serviceVerifyJwt('not.a.valid.token'),
      (err) => {
        assert.equal(err.status, 401);
        return true;
      },
    );
  });

  test('should throw 401 for a token signed with a different secret', async () => {
    const jwt = await import('jsonwebtoken');
    const fakeToken = jwt.default.sign({ userId: 'x' }, 'wrong-secret');
    assert.throws(
      () => serviceVerifyJwt(fakeToken),
      (err) => {
        assert.equal(err.status, 401);
        return true;
      },
    );
  });
});

// ── serviceGenerateSessionId ─────────────────────────────────────────────────

describe('serviceGenerateSessionId', () => {
  test('should return a non-empty string', () => {
    const id = serviceGenerateSessionId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  test('should return unique values on each call', () => {
    assert.notEqual(serviceGenerateSessionId(), serviceGenerateSessionId());
  });
});

// ── serviceExtractLabel ──────────────────────────────────────────────────────

describe('serviceExtractLabel', () => {
  test('should detect iPhone', () => {
    assert.equal(
      serviceExtractLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),
      'iOS Device',
    );
  });

  test('should detect Android', () => {
    assert.equal(
      serviceExtractLabel('Mozilla/5.0 (Linux; Android 13; Pixel 7)'),
      'Android Device',
    );
  });

  test('should detect Chrome (even though Chrome UA also contains Safari)', () => {
    assert.equal(
      serviceExtractLabel(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ),
      'Chrome',
    );
  });

  test('should detect Firefox', () => {
    assert.equal(
      serviceExtractLabel('Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/117.0'),
      'Firefox',
    );
  });

  test('should detect Safari (non-Chrome)', () => {
    assert.equal(
      serviceExtractLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      ),
      'Safari',
    );
  });

  test('should return Unknown device for empty string', () => {
    assert.equal(serviceExtractLabel(''), 'Unknown device');
  });

  test('should return Unknown device for unrecognised UA', () => {
    assert.equal(serviceExtractLabel('SomeBotAgent/1.0'), 'Unknown device');
  });
});

// ── serviceAssertCredentialExists ────────────────────────────────────────────

describe('serviceAssertCredentialExists', () => {
  test('should throw 404 when credential is null', () => {
    assert.throws(
      () => serviceAssertCredentialExists(null),
      (err) => {
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  test('should throw 404 when credential is undefined', () => {
    assert.throws(
      () => serviceAssertCredentialExists(undefined),
      (err) => {
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  test('should not throw when credential exists', () => {
    assert.doesNotThrow(() => serviceAssertCredentialExists({ id: 'x' }));
  });
});

// ── serviceAssertNotLastCredential ───────────────────────────────────────────

describe('serviceAssertNotLastCredential', () => {
  test('should throw 400 when only one credential remains', () => {
    assert.throws(
      () => serviceAssertNotLastCredential([{ id: 'x' }]),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
  });

  test('should not throw when more than one credential exists', () => {
    assert.doesNotThrow(() =>
      serviceAssertNotLastCredential([{ id: 'x' }, { id: 'y' }]),
    );
  });
});

// ── serviceAssertValidUsername ───────────────────────────────────────────────

describe('serviceAssertValidUsername', () => {
  test('should not throw for a valid username', () => {
    assert.doesNotThrow(() => serviceAssertValidUsername('alice_42'));
  });

  test('should throw 400 for a username that is too short', () => {
    assert.throws(() => serviceAssertValidUsername('ab'), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should throw 400 for a username with invalid characters', () => {
    assert.throws(() => serviceAssertValidUsername('user name!'), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should throw 400 for null', () => {
    assert.throws(() => serviceAssertValidUsername(null), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });
});

// ── serviceAssertUsernameAvailable ───────────────────────────────────────────

describe('serviceAssertUsernameAvailable', () => {
  test('should throw 409 when user already exists', () => {
    assert.throws(() => serviceAssertUsernameAvailable({ username: 'alice' }), (err) => {
      assert.equal(err.status, 409);
      return true;
    });
  });

  test('should not throw when user is null', () => {
    assert.doesNotThrow(() => serviceAssertUsernameAvailable(null));
  });
});

// ── serviceAssertSessionValid ────────────────────────────────────────────────

describe('serviceAssertSessionValid', () => {
  test('should throw 400 for null session', () => {
    assert.throws(() => serviceAssertSessionValid(null), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should not throw for a valid session object', () => {
    assert.doesNotThrow(() => serviceAssertSessionValid({ challenge: 'abc', username: 'alice' }));
  });
});

// ── serviceAssertLoginUserExists ─────────────────────────────────────────────

describe('serviceAssertLoginUserExists', () => {
  test('should throw 400 for null user (prevents enumeration in begin step)', () => {
    assert.throws(() => serviceAssertLoginUserExists(null), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should not throw for an existing user', () => {
    assert.doesNotThrow(() => serviceAssertLoginUserExists({ username: 'alice' }));
  });
});

// ── serviceAssertLoginCredentials ────────────────────────────────────────────

describe('serviceAssertLoginCredentials', () => {
  test('should throw 401 for null user', () => {
    assert.throws(() => serviceAssertLoginCredentials(null), (err) => {
      assert.equal(err.status, 401);
      return true;
    });
  });

  test('should not throw for an existing user', () => {
    assert.doesNotThrow(() => serviceAssertLoginCredentials({ username: 'alice' }));
  });
});

// ── serviceAssertStoredCredential ────────────────────────────────────────────

describe('serviceAssertStoredCredential', () => {
  test('should throw 401 for null storedCred', () => {
    assert.throws(() => serviceAssertStoredCredential(null), (err) => {
      assert.equal(err.status, 401);
      return true;
    });
  });

  test('should not throw when storedCred exists', () => {
    assert.doesNotThrow(() => serviceAssertStoredCredential({ credentialId: 'x' }));
  });
});

// ── serviceAssertRegistrationVerified ───────────────────────────────────────

describe('serviceAssertRegistrationVerified', () => {
  test('should throw 400 when verified is false', () => {
    assert.throws(() => serviceAssertRegistrationVerified({ verified: false }), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should throw 400 when verified is true but registrationInfo is missing', () => {
    assert.throws(() => serviceAssertRegistrationVerified({ verified: true }), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });

  test('should not throw when verified and registrationInfo are present', () => {
    assert.doesNotThrow(() =>
      serviceAssertRegistrationVerified({ verified: true, registrationInfo: { credential: {} } }),
    );
  });
});

// ── serviceAssertAuthenticationVerified ─────────────────────────────────────

describe('serviceAssertAuthenticationVerified', () => {
  test('should throw 401 when verified is false', () => {
    assert.throws(() => serviceAssertAuthenticationVerified({ verified: false }), (err) => {
      assert.equal(err.status, 401);
      return true;
    });
  });

  test('should throw 401 when verified is true but authenticationInfo is missing', () => {
    assert.throws(() => serviceAssertAuthenticationVerified({ verified: true }), (err) => {
      assert.equal(err.status, 401);
      return true;
    });
  });

  test('should not throw when verified and authenticationInfo are present', () => {
    assert.doesNotThrow(() =>
      serviceAssertAuthenticationVerified({ verified: true, authenticationInfo: { newCounter: 1 } }),
    );
  });
});

// ── serviceAssertRecoveryCodeValid ───────────────────────────────────────────

describe('serviceAssertRecoveryCodeValid', () => {
  test('should throw 401 when matched is false', () => {
    assert.throws(() => serviceAssertRecoveryCodeValid(false), (err) => {
      assert.equal(err.status, 401);
      return true;
    });
  });

  test('should not throw when matched is true', () => {
    assert.doesNotThrow(() => serviceAssertRecoveryCodeValid(true));
  });
});

// ── serviceAssertUserFound ───────────────────────────────────────────────────

describe('serviceAssertUserFound', () => {
  test('should throw 404 for null user', () => {
    assert.throws(() => serviceAssertUserFound(null), (err) => {
      assert.equal(err.status, 404);
      return true;
    });
  });

  test('should not throw for an existing user', () => {
    assert.doesNotThrow(() => serviceAssertUserFound({ username: 'alice' }));
  });
});

// ── serviceFormatUser ────────────────────────────────────────────────────────

describe('serviceFormatUser', () => {
  test('should return only the expected fields', () => {
    const user = {
      username: 'alice',
      role: 'user',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-01'),
      credentials: [],
      recoveryCodes: [],
    };
    const result = serviceFormatUser(user);
    assert.deepEqual(Object.keys(result).sort(), ['createdAt', 'role', 'updatedAt', 'username']);
    assert.equal(result.username, 'alice');
    assert.equal(result.role, 'user');
  });
});

// ── serviceFormatPasskey ─────────────────────────────────────────────────────

describe('serviceFormatPasskey', () => {
  test('should return id as string, label, and createdAt', () => {
    const cred = {
      _id: { toString: () => 'cred-id-123' },
      label: 'Chrome',
      createdAt: new Date('2024-01-01'),
      publicKey: Buffer.from([1, 2, 3]),
    };
    const result = serviceFormatPasskey(cred);
    assert.deepEqual(Object.keys(result).sort(), ['createdAt', 'id', 'label']);
    assert.equal(result.id, 'cred-id-123');
    assert.equal(result.label, 'Chrome');
  });
});

// ── serviceGetCookieOptions ──────────────────────────────────────────────────

describe('serviceGetCookieOptions', () => {
  test('should return httpOnly, sameSite, secure, and maxAge', () => {
    const opts = serviceGetCookieOptions();
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, 'strict');
    assert.equal(typeof opts.maxAge, 'number');
    assert.ok(opts.maxAge > 0);
  });

  test('secure should be false outside production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    assert.equal(serviceGetCookieOptions().secure, false);
    process.env.NODE_ENV = prev;
  });
});

// ── serviceBuildRecoveryCodeStorage ─────────────────────────────────────────

describe('serviceBuildRecoveryCodeStorage', () => {
  test('should map codes to { code: hashed, used: false }', () => {
    const codes = [{ plain: 'ABCD-EFGH-IJKL', hashed: 'hash1' }];
    const result = serviceBuildRecoveryCodeStorage(codes);
    assert.deepEqual(result, [{ code: 'hash1', used: false }]);
  });
});

// ── serviceBuildCredentialPayload ────────────────────────────────────────────

describe('serviceBuildCredentialPayload', () => {
  test('should build the DB storage shape from a verified credential', () => {
    const cred = { id: 'cred-id', publicKey: new Uint8Array([1, 2, 3]), counter: 0 };
    const credential = { response: { transports: ['internal'] } };
    const result = serviceBuildCredentialPayload(cred, credential, 'Chrome');
    assert.equal(result.credentialId, 'cred-id');
    assert.ok(Buffer.isBuffer(result.publicKey));
    assert.equal(result.counter, 0);
    assert.deepEqual(result.transports, ['internal']);
    assert.equal(result.label, 'Chrome');
  });

  test('should default transports to empty array when response.transports is absent', () => {
    const cred = { id: 'cred-id', publicKey: new Uint8Array([1]), counter: 0 };
    const credential = {};
    const result = serviceBuildCredentialPayload(cred, credential, 'Unknown');
    assert.deepEqual(result.transports, []);
  });
});

// ── serviceIssueSession ──────────────────────────────────────────────────────

describe('serviceIssueSession', () => {
  test('should call res.cookie with AUTH_COOKIE_NAME and a JWT string, and return formatted user', () => {
    const mockRes = { cookie: mock.fn() };
    const user = {
      _id: { toString: () => 'user-id' },
      username: 'alice',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = serviceIssueSession(mockRes, user);
    assert.equal(mockRes.cookie.mock.calls.length, 1);
    assert.equal(mockRes.cookie.mock.calls[0].arguments[0], 'authToken');
    assert.equal(typeof mockRes.cookie.mock.calls[0].arguments[1], 'string');
    assert.equal(result.username, 'alice');
    assert.equal(result.role, 'user');
  });
});

// ── serviceClearSession ──────────────────────────────────────────────────────

describe('serviceClearSession', () => {
  test('should call res.clearCookie with AUTH_COOKIE_NAME', () => {
    const mockRes = { clearCookie: mock.fn() };
    serviceClearSession(mockRes);
    assert.equal(mockRes.clearCookie.mock.calls.length, 1);
    assert.equal(mockRes.clearCookie.mock.calls[0].arguments[0], 'authToken');
  });
});
