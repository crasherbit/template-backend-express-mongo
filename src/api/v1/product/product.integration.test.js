import { expect } from 'chai';
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
    it('should return status OK', async () => {
      const res = await request.get('/api/v1/health');

      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal('OK');
      expect(res.body).to.have.property('uptime');
      expect(res.body).to.have.property('serverTime');
    });
  });

  // ── CREATE ─────────────────────────────────────────────────
  describe('POST /api/v1/product', () => {
    it('should create a product', async () => {
      const res = await request
        .post('/api/v1/product')
        .send({ name: 'Integration Test', price: 19.99, category: 'test' });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal('OK');
      expect(res.body.payload).to.have.property('_id');
      expect(res.body.payload.name).to.equal('Integration Test');
      expect(res.body.payload.price).to.equal(19.99);

      createdId = res.body.payload._id;
    });

    it('should reject creation without name', async () => {
      const res = await request.post('/api/v1/product').send({ price: 5 });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('name is required');
    });

    it('should reject creation without price', async () => {
      const res = await request
        .post('/api/v1/product')
        .send({ name: 'No Price' });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('price is required');
    });
  });

  // ── LIST ───────────────────────────────────────────────────
  describe('GET /api/v1/product', () => {
    it('should return a list with at least one product', async () => {
      const res = await request.get('/api/v1/product');

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.be.an('array').that.is.not.empty;
    });
  });

  // ── GET ONE ────────────────────────────────────────────────
  describe('GET /api/v1/product/:id', () => {
    it('should return the created product', async () => {
      const res = await request.get(`/api/v1/product/${createdId}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload._id).to.equal(createdId);
      expect(res.body.payload.name).to.equal('Integration Test');
    });
  });

  // ── UPDATE ─────────────────────────────────────────────────
  describe('PUT /api/v1/product/:id', () => {
    it('should update the product name', async () => {
      const res = await request
        .put(`/api/v1/product/${createdId}`)
        .send({ name: 'Updated Name' });

      expect(res.status).to.equal(200);
      expect(res.body.payload.name).to.equal('Updated Name');
      expect(res.body.payload.price).to.equal(19.99); // unchanged
    });
  });

  // ── DELETE ─────────────────────────────────────────────────
  describe('DELETE /api/v1/product/:id', () => {
    it('should delete the product', async () => {
      const res = await request.delete(`/api/v1/product/${createdId}`);

      expect(res.status).to.equal(200);
    });

    it('should no longer find the deleted product', async () => {
      const res = await request.get(`/api/v1/product/${createdId}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.be.null;
    });
  });
});
