import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, page, timestamp }) => {
      const pageLabel = page ? ` [${page}]` : '';
      return `${timestamp}${pageLabel} ${level}: ${message}`;
    }),
  ),
  transports: [new transports.Console()],
});
