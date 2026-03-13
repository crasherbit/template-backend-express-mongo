import { Order } from '../../../entities/order/index.js';

/**
 * Creates a new order in the database.
 * @param {Object} data Order payload
 * @param {string} data.userId
 * @param {Array<{productId: string, quantity: number, priceAtPurchase: number}>} data.products
 * @param {number} data.totalAmount
 * @param {string} data.status
 * @returns {Promise<import('mongoose').Document>}
 */
export const daoCreateOrder = async (data) => await Order.create(data);

/**
 * Simulated query to retrieve user data, mocking an external or internal module.
 * @param {string} userId 
 * @returns {Promise<{id: string, email: string, balance: number}>}
 */
export const daoGetUser = async (userId) => { 
  return { 
    id: userId, 
    email: 'user@example.com', 
    balance: 100 
  }; 
};

/**
 * Retrieves an order by its ID.
 * @param {string} id 
 * @returns {Promise<import('mongoose').Document | null>}
 */
export const daoGetOrder = async (id) => await Order.findById(id);

/**
 * Updates an order status. Mongoose validation will automatically run to ensure valid enum.
 * @param {string} id 
 * @param {string} status 
 * @returns {Promise<import('mongoose').Document | null>}
 */
export const daoUpdateOrderStatus = async (id, status) =>
  await Order.findByIdAndUpdate(
    id, 
    { status }, 
    { returnDocument: 'after', runValidators: true }
  );
