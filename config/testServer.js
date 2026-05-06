import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/app.js';

// Ensure JWT_SECRET is always set in test environment
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

let server;

/**
 * Start the Express server + connect to MongoDB.
 * Uses the MONGODB_CONNSTRING env var (set to the test DB).
 */
export const startServer = async () => {
  const uniqueDb = `test_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
  await mongoose.connect(process.env.MONGODB_CONNSTRING, { dbName: uniqueDb });
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      resolve(server);
    });
  });
};

/**
 * Drop the test database, close the connection, and stop the server.
 */
export const stopServer = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (server) {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  }
};

/**
 * Generate a valid authToken cookie string for use in authenticated test requests.
 * Does NOT create a user in the database — only signs a JWT.
 *
 * @param {object} overrides - Override default payload fields (userId, username, role).
 * @returns {string} Cookie string to pass as .set('Cookie', cookie).
 */
export const createTestAuthCookie = (overrides = {}) => {
  const payload = {
    userId: '000000000000000000000001',
    username: 'testuser',
    role: 'user',
    ...overrides,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `authToken=${token}`;
};

export { app };
