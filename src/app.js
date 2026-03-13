import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { CONFIG } from '../config/utilsManager.js';
import { router } from './api/v1/router.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(logger);
app.use(express.json());
app.set('port', process.env.PORT || 3000);

if (process.env.NODE_ENV !== 'production') {
  app.use('/documentation', express.static('out'));
}

app.use(helmet());
app.use(cookieParser());
app.use(cors(CONFIG.cors));
app.use(compression());
app.use(rateLimit(CONFIG.rateLimit));

app.use('/api/v1', router);

export { app };
