import createHttpError from 'http-errors';
import { Roles, AUTH_COOKIE_NAME } from './constants.js';
import { verifyJwt } from './jwt.js';

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
    e = createHttpError.InternalServerError({
      message: 'An unexpected error occurred',
      payload: {
        originalError: e.message,
        stack: e.stack,
      },
    });
  }
  sendResponse(res, e.status, e.message, e.payload || e);
};

const verifyJwtFromCookie = (req) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) throw createHttpError.Unauthorized('Authentication required');
  return verifyJwt(token);
};

const wrapHandler = (cb, options = {}) => {
  const {
    authenticated = false,
    roles = Object.values(Roles),
    noContent = false,
  } = options;

  return async (req, res, next) => {
    try {
      if (authenticated) {
        const payload = verifyJwtFromCookie(req);
        // `id` alias allows existing code that reads req.user.id to keep working
        req.user = { ...payload, id: payload.userId };

        if (roles.length > 0 && !roles.includes(req.user.role)) {
          throw createHttpError.Forbidden('Insufficient permissions');
        }
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
  authenticated: ({ cb, roles = Object.values(Roles), noContent = false }) => {
    return wrapHandler(cb, { authenticated: true, roles, noContent });
  },
  public: (cb) => {
    return wrapHandler(cb);
  },
  publicNoContent: (cb) => {
    return wrapHandler(cb, { noContent: true });
  },
};
