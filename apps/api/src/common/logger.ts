import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

export const winstonLoggerConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.json(),
      ),
    }),
  ],
};

export function createWinstonLogger() {
  return WinstonModule.createLogger(winstonLoggerConfig);
}
