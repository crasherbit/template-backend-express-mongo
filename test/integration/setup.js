import mongoose from 'mongoose';
import { app } from '../../src/app.js';

let server;

/**
 * Start the Express server + connect to MongoDB.
 * Uses the MONGODB_CONNSTRING env var (set to the test DB).
 */
export const startServer = async () => {
  await mongoose.connect(process.env.MONGODB_CONNSTRING);
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

export { app };
