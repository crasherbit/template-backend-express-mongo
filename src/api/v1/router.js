import express from 'express';
import { Path } from '../../utils/constants.js';
import { product } from './product/controller.js';

export const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    serverTime: new Date(),
    uptime: process.uptime(),
  });
});

router.use(Path.PRODUCT, product);
