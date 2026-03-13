import createHttpError from 'http-errors';
import { Roles } from './constants.js';

const sendResponse = (res, status, message, payload) => {
  res.status(status).send({ status, message, payload });
};

const handleError = (res, e) => {
  if (e.name === 'ValidationError') {
    const messages = Object.values(e.errors).map((err) => err.message);
    return sendResponse(res, 400, 'Validation Error', messages);
  }

  if (e.name === 'CastError') {
    return sendResponse(res, 400, 'Invalid ID format', e.message);
  }

  if (!(e instanceof createHttpError.HttpError)) {
    e = createHttpError.InternalServerError();
  }
  sendResponse(res, e.status, e.message, e);
};

const wrapHandler = (cb, options = {}) => {
  const { authenticated = false, noContent = false } = options;

  return async (req, res, next) => {
    try {
      if (authenticated) {
        // TODO: implement authentication logic (JWT verify, set req.user)
        req.user = {};
      }

      const data = await cb(req, res, next);

      if (noContent) {
        return sendResponse(res, 204, 'No Content', null);
      }

      sendResponse(res, 200, 'OK', data);
    } catch (e) {
      handleError(res, e);
    }
  };
};

export const handler = {
  authenticated: ({ cb, roles = Object.values(Roles) }) => {
    return wrapHandler(cb, { authenticated: true, roles });
  },
  public: (cb) => {
    return wrapHandler(cb);
  },
  publicNoContent: (cb) => {
    return wrapHandler(cb, { noContent: true });
  },
};
