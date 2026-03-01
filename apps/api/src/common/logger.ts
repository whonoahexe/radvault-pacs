import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

export const winstonLoggerConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
      ),
    }),
  ],
};

export function createWinstonLogger() {
  return WinstonModule.createLogger(winstonLoggerConfig);
}
