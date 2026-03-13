import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { serviceValidateCreate, serviceValidateUpdate } from './service.js';

describe('Product Service', () => {
  describe('serviceValidateCreate', () => {
    test('should return raw data mapped for Mongoose to validate', () => {
      const result = serviceValidateCreate({
        name: ' Test Product ',
        price: 9.99,
        category: 'electronics',
      });

      assert.equal(result.name, ' Test Product ');
      assert.equal(result.price, 9.99);
      assert.equal(result.category, 'electronics');
    });
  });

  describe('serviceValidateUpdate', () => {
    test('should return only provided fields', () => {
      const result = serviceValidateUpdate({ name: ' Updated ' });
      assert.deepEqual(result, { name: ' Updated ' });
    });

    test('should return empty object if no fields provided', () => {
      const result = serviceValidateUpdate({});
      assert.deepEqual(result, {});
    });
  });
});
