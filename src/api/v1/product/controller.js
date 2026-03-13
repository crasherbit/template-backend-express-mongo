import express from 'express';
import { Roles } from '../../../utils/constants.js';
import { handler } from '../../../utils/handler.js';
import {
  daoCreateOne,
  daoDeleteOne,
  daoGetList,
  daoGetOne,
  daoUpdateOne,
} from './dao.js';
import { serviceValidateCreate, serviceValidateUpdate } from './service.js';

export const product = express.Router();

product.get('/', handler.public(getList));
product.get('/:id', handler.public(getOne));
product.post('/', handler.authenticated({ cb: createOne }));
product.put('/:id', handler.authenticated({ cb: updateOne }));
product.delete(
  '/:id',
  handler.authenticated({ cb: deleteOne, roles: [Roles.ADMIN] })
);

async function getList() {
  const products = await daoGetList();
  return products;
}

async function getOne(req) {
  const { id } = req.params;
  const item = await daoGetOne(id);
  return item;
}

async function createOne(req) {
  const data = serviceValidateCreate(req.body);
  const item = await daoCreateOne(data);
  return item;
}

async function updateOne(req) {
  const { id } = req.params;
  const data = serviceValidateUpdate(req.body);
  const item = await daoUpdateOne(id, data);
  return item;
}

async function deleteOne(req) {
  const { id } = req.params;
  const item = await daoDeleteOne(id);
  return item;
}
