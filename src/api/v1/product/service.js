import createHttpError from 'http-errors';

export const serviceValidateCreate = (body) => {
  if (!body.name || typeof body.name !== 'string') {
    throw createHttpError.BadRequest('name is required and must be a string');
  }
  if (body.price == null || typeof body.price !== 'number') {
    throw createHttpError.BadRequest('price is required and must be a number');
  }

  return {
    name: body.name.trim(),
    description: body.description?.trim() || '',
    price: body.price,
    category: body.category?.trim() || '',
    active: body.active ?? true,
  };
};

export const serviceValidateUpdate = (body) => {
  const data = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string')
      throw createHttpError.BadRequest('name must be a string');
    data.name = body.name.trim();
  }
  if (body.description !== undefined) {
    data.description = String(body.description).trim();
  }
  if (body.price !== undefined) {
    if (typeof body.price !== 'number')
      throw createHttpError.BadRequest('price must be a number');
    data.price = body.price;
  }
  if (body.category !== undefined) {
    data.category = String(body.category).trim();
  }
  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  return data;
};
