import { strict as assert } from 'node:assert';
import { beforeEach, describe, mock, test } from 'node:test';

// Before importing the controller, we must mock the dao module
mock.module('./dao.js', {
  namedExports: {
    daoGetUser: mock.fn(),
    daoCreateOrder: mock.fn(),
    daoGetOrder: mock.fn(),
    daoUpdateOrderStatus: mock.fn()
  }
});

// Now dynamically import the controller and the mocked dao
const { _testable } = await import('./controller.js');
const dao = await import('./dao.js');

describe('Order Controller: processOrder orchestrator', () => {
  beforeEach(() => {
    // Reset call counts and mock implementations after each test
    mock.restoreAll();
  });

  test('Should successfully create an order if the user has enough balance', async () => {
    const mockUser = { id: 'user1', email: 'test@mail.com', balance: 500 };
    dao.daoGetUser.mock.mockImplementation(async () => mockUser);

    let dbPayload = null;
    dao.daoCreateOrder.mock.mockImplementation(async (data) => {
      dbPayload = data;
      return { _id: 'order_123', ...data };
    });

    const reqMock = {
      user: { id: 'user1' },
      body: {
        products: [
          { productId: 'prodA', quantity: 2, priceAtPurchase: 100 }, // total: 200
        ],
      },
    };

    const res = await _testable.processOrder(reqMock);

    assert.equal(res._id, 'order_123');
    assert.equal(res.totalAmount, 200);
    assert.equal(dbPayload.userId, 'user1');
    assert.equal(dbPayload.status, 'PENDING');
  });

  test('Should throw 402 error if the balance is insufficient', async () => {
    const mockUser = { id: 'user1', balance: 50 };
    dao.daoGetUser.mock.mockImplementation(async () => mockUser);

    const reqMock = {
      user: { id: 'user1' },
      body: {
        products: [
          { productId: 'prodA', quantity: 1, priceAtPurchase: 100 }, // total: 100
        ],
      },
    };

    await assert.rejects(
      async () => await _testable.processOrder(reqMock),
      (err) => {
        assert.equal(err.status, 402);
        return true;
      }
    );
  });
});

describe('Order Controller: updateOrderStatus orchestrator', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  test('Should throw 404 if the order does not exist', async () => {
    dao.daoGetOrder.mock.mockImplementation(async () => null);

    const reqMock = {
      params: { id: 'nonexistent' },
      body: { status: 'PAID' },
    };

    await assert.rejects(
      async () => await _testable.updateOrderStatus(reqMock),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.message, 'Order not found');
        return true;
      }
    );
  });

  test('Should throw 400 if transitioning to an invalid states (e.g. SHIPPED -> PAID)', async () => {
    dao.daoGetOrder.mock.mockImplementation(async () => ({
      id: '123',
      status: 'SHIPPED',
    }));

    const reqMock = {
      params: { id: '123' },
      body: { status: 'PAID' },
    };

    await assert.rejects(
      async () => await _testable.updateOrderStatus(reqMock),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('Should successfully transition order when valid and save it', async () => {
    dao.daoGetOrder.mock.mockImplementation(async () => ({
      id: '123',
      status: 'PENDING',
    }));

    let dbPayload = null;
    dao.daoUpdateOrderStatus.mock.mockImplementation(async (id, status) => {
      dbPayload = { id, status };
      return { id, status };
    });

    const reqMock = {
      params: { id: '123' },
      body: { status: 'PAID' },
    };

    const res = await _testable.updateOrderStatus(reqMock);

    assert.equal(res.status, 'PAID');
    assert.equal(dbPayload.id, '123');
    assert.equal(dbPayload.status, 'PAID');
  });
});
