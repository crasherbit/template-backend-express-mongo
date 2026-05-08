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

// Trust the first proxy (ngrok, nginx, etc.) so that express-rate-limit
// can read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);
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

// Digital Asset Links — required for Android native passkey support.
// Android verifies this file before allowing any passkey manager to create
// or use a passkey for this app. The SHA256 fingerprint must match the
// app's signing certificate (debug key shown here; add release key for prod).
// See: https://developers.google.com/digital-asset-links/v1/getting-started
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.json([
    {
      relation: [
        'delegate_permission/common.handle_all_urls',
        'delegate_permission/common.get_login_creds',
      ],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE_NAME || 'com.example.trackly',
        sha256_cert_fingerprints: [
          // Debug signing key (flutter run / debug builds)
          'F4:94:DC:AD:6D:89:D0:11:C5:DA:B5:58:51:BC:F1:F0:8A:D2:E5:6B:DF:9F:5D:1F:7B:C1:F4:7A:13:5B:50:BC',
        ],
      },
    },
  ]);
});

export { app };
