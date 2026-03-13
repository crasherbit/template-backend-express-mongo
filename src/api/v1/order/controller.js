import express from 'express';
import { handler } from '../../../utils/handler.js';
import {
  daoCreateOrder,
  daoGetOrder,
  daoGetUser,
  daoUpdateOrderStatus,
} from './dao.js';
import {
  assertOrderExists,
  assertUserCanMakeOrder,
  assertValidStatusTransition,
  buildOrderPayload,
  calculateTotalAmount,
} from './service.js';

export const order = express.Router();

order.post('/', handler.authenticated({ cb: processOrder }));
order.patch('/:id/status', handler.authenticated({ cb: updateOrderStatus }));

/**
 * Controller as ORCHESTRATOR
 * The function is a clear "recipe" of what the API does:
 * 1. Data extraction
 * 2. Read from DB (DAO)
 * 3. Business Logic / Calculations (Service)
 * 4. Evaluate Business Assertions (Service)
 * 5. Write to DB (DAO) - Payload validation is delegated to Mongoose
 * 6. External utilities or side-effects (Email, notifications)
 * 7. Response
 *
 * @param {import('express').Request} req
 * @returns {Promise<Object>}
 */
async function processOrder(req) {
  // 1. Data extraction
  const { products } = req.body;
  const userId = req.user?.id || '60c72b2f9b1d8b001c8e4d1a'; // Mock ID for local dev missing Auth module

  // 2. Read from DB
  const user = await daoGetUser(userId);

  // 3. Logic and Calculations (pure)
  const totalAmount = calculateTotalAmount(products);

  // 4. Business assertions (Throws HTTP exception if failed)
  assertUserCanMakeOrder(user, totalAmount);

  // 5. Build payload to send to DB (Service - pure)
  const orderPayload = buildOrderPayload(userId, products, totalAmount);

  // 6. Write to DB
  const newOrder = await daoCreateOrder(orderPayload);

  // 7. Return
  return newOrder;
}

/**
 * Orchestrator for handling an order status update.
 * @param {import('express').Request} req
 * @returns {Promise<Object>}
 */
async function updateOrderStatus(req) {
  // 1. Data extraction
  const { id } = req.params;
  const { status } = req.body;

  // 2. Read DB
  const order = await daoGetOrder(id);

  // 3. Logic & Assertions
  assertOrderExists(order);
  assertValidStatusTransition(order.status, status);

  // 4. Write DB (Triggers Mongoose Enum validations)
  const updatedOrder = await daoUpdateOrderStatus(id, status);

  // 5. Return
  return updatedOrder;
}

// Export the orchestrator to test the logic individually
export const _testable = { processOrder, updateOrderStatus };
