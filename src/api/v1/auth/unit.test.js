import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

process.env.JWT_SECRET = 'test-unit-secret';

import {
  serviceAssertCredentialExists,
  serviceAssertNotLastCredential,
  serviceExtractLabel,
  serviceGenerateJwt,
  serviceGenerateRecoveryCodes,
  serviceGenerateSessionId,
  serviceHashRecoveryCode,
  serviceVerifyJwt,
  serviceVerifyRecoveryCode,
} from './service.js';

// ── serviceGenerateRecoveryCodes ────────────────────────────────────────────

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

// ── serviceHashRecoveryCode ─────────────────────────────────────────────────

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
});

// ── serviceVerifyRecoveryCode ───────────────────────────────────────────────

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
});

// ── serviceGenerateJwt / serviceVerifyJwt ───────────────────────────────────

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

// ── serviceGenerateSessionId ────────────────────────────────────────────────

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

// ── serviceExtractLabel ─────────────────────────────────────────────────────

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

// ── serviceAssertCredentialExists ───────────────────────────────────────────

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

// ── serviceAssertNotLastCredential ──────────────────────────────────────────

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
