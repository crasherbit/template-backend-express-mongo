import { strict as assert } from 'node:assert';
import { after, before, describe, test } from 'node:test';
import supertest from 'supertest';
import { app, startServer, stopServer } from '../../../../config/testServer.js';

let request;

describe('Order API — Integration (Negative First)', () => {
  before(async () => {
    await startServer();
    request = supertest(app);
  });

  after(async () => {
    await stopServer();
  });

  let createdId;

  describe('POST /api/v1/order (Negative Tests)', () => {
    test('should return 400 Bad Request if validation fails (e.g., quantity is 0)', async () => {
      const res = await request.post('/api/v1/order').send({
        products: [
          {
            productId: '60c72b2f9b1d8b001c8e4d1a',
            quantity: 0,
            priceAtPurchase: 20,
          },
        ],
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('Validation Error'));
    });

    test('should return 400 Bad Request if product contains negative price', async () => {
      const products = [
        {
          productId: '60c72b2f9b1d8b001c8e4d1a',
          quantity: 1,
          priceAtPurchase: -10,
        },
      ];
      const res = await request.post('/api/v1/order').send({ products });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('Validation Error'));
    });
  });

  describe('POST /api/v1/order (Positive Test)', () => {
    test('should process an order successfully', async () => {
      const products = [
        {
          productId: '60c72b2f9b1d8b001c8e4d1a',
          quantity: 2,
          priceAtPurchase: 20,
        },
      ];

      const res = await request.post('/api/v1/order').send({ products });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'OK');
      assert.ok(res.body.payload._id);

      createdId = res.body.payload._id;
    });
  });

  describe('PATCH /api/v1/order/:id/status (Negative Tests)', () => {
    test('should return 404 for non-existent order ID', async () => {
      // 24 character valid hex string but non existent
      const res = await request
        .patch('/api/v1/order/5f8d04f1234b0c1110e5abc8/status')
        .send({ status: 'PAID' });

      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Order not found');
    });

    test('should return 400 for completely invalid ID (CastError)', async () => {
      const res = await request
        .patch('/api/v1/order/invalid-id/status')
        .send({ status: 'PAID' });

      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid ID format');
    });

    test('should return 400 if transitioning to an logically unallowed status string', async () => {
      const res = await request
        .patch(`/api/v1/order/${createdId}/status`)
        .send({ status: 'MAGIC' });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('Cannot transition'));
    });

    test('should return 400 if making an invalid logical transition (SHIPPED -> PENDING) due to service rules', async () => {
      // First legitimately make it PAID
      const res1 = await request
        .patch(`/api/v1/order/${createdId}/status`)
        .send({ status: 'PAID' });
      assert.equal(
        res1.status,
        200,
        `Expected 200 for PAID, got ${res1.status}: ${JSON.stringify(res1.body)}`
      );

      // Then legitimately make it SHIPPED
      const res2 = await request
        .patch(`/api/v1/order/${createdId}/status`)
        .send({ status: 'SHIPPED' });
      assert.equal(
        res2.status,
        200,
        `Expected 200 for SHIPPED, got ${res2.status}: ${JSON.stringify(res2.body)}`
      );

      // Then attempt to go back
      const res3 = await request
        .patch(`/api/v1/order/${createdId}/status`)
        .send({ status: 'PENDING' });

      assert.equal(
        res3.status,
        400,
        `Expected 400 for PENDING, got ${res3.status}: ${JSON.stringify(res3.body)}`
      );
      assert.ok(
        res3.body.message.includes(
          'Cannot transition order from SHIPPED to PENDING'
        )
      );
    });
  });
});
