import createHttpError from 'http-errors';

/**
 * Pure function: calculates the mathematical total
 * @param {Array<{productId: string, quantity: number, priceAtPurchase: number}>} products
 * @returns {number} The total amount
 */
export const calculateTotalAmount = (products = []) => {
  return products.reduce((acc, p) => acc + p.priceAtPurchase * p.quantity, 0);
};

/**
 * Business logic assertion: performs checks on user balance and throws business errors (http-errors)
 * @param {{id: string, email: string, balance: number}} user
 * @param {number} totalAmount
 * @throws {import('http-errors').HttpError}
 */
export const assertUserCanMakeOrder = (user, totalAmount) => {
  if (user.balance < totalAmount) {
    throw createHttpError.PaymentRequired(
      'User balance is insufficient to complete the order'
    );
  }
};

/**
 * Pure function: assembles the order payload to save
 * @param {string} userId
 * @param {Array<Object>} products
 * @param {number} totalAmount
 * @returns {Object} Mapped payload for Mongoose
 */
export const buildOrderPayload = (userId, products, totalAmount) => {
  return {
    userId,
    products,
    totalAmount,
    status: 'PENDING',
  };
};

/**
 * Business logic assertion: checks if an order exists.
 * @param {Object} order
 * @throws {import('http-errors').HttpError}
 */
export const assertOrderExists = (order) => {
  if (!order) throw createHttpError.NotFound('Order not found');
};

/**
 * Business logic assertion: checks if a transition state is valid mapping it against allowed paths.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @throws {import('http-errors').HttpError}
 */
export const assertValidStatusTransition = (currentStatus, newStatus) => {
  const allowed = {
    PENDING: ['PAID', 'CANCELLED'],
    PAID: ['SHIPPED', 'CANCELLED'],
    SHIPPED: [],
    CANCELLED: [],
  };

  if (!allowed[currentStatus]?.includes(newStatus)) {
    throw createHttpError.BadRequest(
      `Cannot transition order from ${currentStatus} to ${newStatus}`
    );
  }
};
