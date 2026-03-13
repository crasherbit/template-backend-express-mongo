import expressWinston from 'express-winston';
import winston from 'winston';

const logger = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({
          all: true,
        }),
        winston.format.timestamp({
          format: 'DD-MM-YY HH:mm',
        }),
        winston.format.printf((info) => {
          // Check if the meta object and request object are present
          const request = info.meta?.req ?? null;
          const ip = request ? request.ip : 'unknown IP';
          return ` ${info.level} ${info.timestamp} [IP: ${ip}] : ${info.message}`;
        })
      ),
    }),
  ],
  expressFormat: true,
  colorize: true,
  meta: true, // Ensure meta is true to capture the request object
  msg: 'HTTP {{req.method}} {{req.url}}', // Custom message format
  requestWhitelist: [...expressWinston.requestWhitelist, 'ip'], // Include IP in the request whitelist
});

export { logger };
