import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, 'ScreenWise API listening'),
);
server.on('error', (err) => {
  logger.fatal({ err }, 'Unable to start API');
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
