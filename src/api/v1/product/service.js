export const serviceValidateCreate = (body) => {
  return {
    name: body.name,
    description: body.description,
    price: body.price,
    category: body.category,
    active: body.active,
  };
};

export const serviceValidateUpdate = (body) => {
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.price !== undefined) data.price = body.price;
  if (body.category !== undefined) data.category = body.category;
  if (body.active !== undefined) data.active = body.active;
  
  return data;
};
