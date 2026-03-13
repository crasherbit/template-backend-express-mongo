import { Product } from '../../../entities/product/index.js';

export const daoGetList = async (filter = {}) => await Product.find(filter);

export const daoGetOne = async (id) => await Product.findById(id);

export const daoCreateOne = async (data) => await Product.create(data);

export const daoUpdateOne = async (id, data) =>
  await Product.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  });

export const daoDeleteOne = async (id) => await Product.findByIdAndDelete(id);
