import { strict as assert } from 'node:assert';
import { after, before, describe, test } from 'node:test';
import supertest from 'supertest';
import { app, startServer, stopServer } from '../../../../config/testServer.js';

let request;

describe('Product API — Integration', () => {
  before(async () => {
    await startServer();
    request = supertest(app);
  });

  after(async () => {
    await stopServer();
  });

  let createdId;

  // ── Health ──────────────────────────────────────────────────
  describe('GET /api/v1/health', () => {
    test('should return status OK', async () => {
      const res = await request.get('/api/v1/health');

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'OK');
      assert.ok(res.body.uptime !== undefined);
      assert.ok(res.body.serverTime !== undefined);
    });
  });

  // ── CREATE ─────────────────────────────────────────────────
  describe('POST /api/v1/product', () => {
    test('should create a product', async () => {
      const res = await request
        .post('/api/v1/product')
        .send({ name: 'Integration Test', price: 19.99, category: 'test' });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'OK');
      assert.ok(res.body.payload._id);
      assert.equal(res.body.payload.name, 'Integration Test');
      assert.equal(res.body.payload.price, 19.99);

      createdId = res.body.payload._id;
    });

    test('should reject creation without name', async () => {
      const res = await request.post('/api/v1/product').send({ price: 5 });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('Validation Error'));
    });

    test('should reject creation without price', async () => {
      const res = await request
        .post('/api/v1/product')
        .send({ name: 'No Price' });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('Validation Error'));
    });
  });

  // ── LIST ───────────────────────────────────────────────────
  describe('GET /api/v1/product', () => {
    test('should return a list with at least one product', async () => {
      const res = await request.get('/api/v1/product');

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.payload));
      assert.ok(res.body.payload.length > 0);
    });
  });

  // ── GET ONE ────────────────────────────────────────────────
  describe('GET /api/v1/product/:id', () => {
    test('should return the created product', async () => {
      const res = await request.get(`/api/v1/product/${createdId}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.payload._id, createdId);
      assert.equal(res.body.payload.name, 'Integration Test');
    });
  });

  // ── UPDATE ─────────────────────────────────────────────────
  describe('PUT /api/v1/product/:id', () => {
    test('should update the product name', async () => {
      const res = await request
        .put(`/api/v1/product/${createdId}`)
        .send({ name: 'Updated Name' });

      assert.equal(res.status, 200);
      assert.equal(res.body.payload.name, 'Updated Name');
      assert.equal(res.body.payload.price, 19.99); // unchanged
    });
  });

  // ── DELETE ─────────────────────────────────────────────────
  describe('DELETE /api/v1/product/:id', () => {
    test('should delete the product', async () => {
      const res = await request.delete(`/api/v1/product/${createdId}`);

      assert.equal(res.status, 200);
    });

    test('should no longer find the deleted product', async () => {
      const res = await request.get(`/api/v1/product/${createdId}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.payload, null);
    });
  });
});
