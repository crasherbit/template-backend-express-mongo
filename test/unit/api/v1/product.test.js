import { expect } from 'chai';
import {
  serviceValidateCreate,
  serviceValidateUpdate,
} from '../../../../src/api/v1/product/service.js';

describe('Product Service', () => {
  describe('serviceValidateCreate', () => {
    it('should validate and return normalized data', () => {
      const result = serviceValidateCreate({
        name: ' Test Product ',
        price: 9.99,
        category: ' electronics ',
      });

      expect(result.name).to.equal('Test Product');
      expect(result.price).to.equal(9.99);
      expect(result.category).to.equal('electronics');
      expect(result.active).to.equal(true);
    });

    it('should throw if name is missing', () => {
      expect(() => serviceValidateCreate({ price: 10 })).to.throw(
        'name is required'
      );
    });

    it('should throw if price is missing', () => {
      expect(() => serviceValidateCreate({ name: 'Test' })).to.throw(
        'price is required'
      );
    });
  });

  describe('serviceValidateUpdate', () => {
    it('should return only provided fields', () => {
      const result = serviceValidateUpdate({ name: ' Updated ' });
      expect(result).to.deep.equal({ name: 'Updated' });
    });

    it('should return empty object if no fields provided', () => {
      const result = serviceValidateUpdate({});
      expect(result).to.deep.equal({});
    });
  });
});
