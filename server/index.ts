import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 5174);
// 127.0.0.1 keeps the app private to this laptop. Set HOST=0.0.0.0 to open it
// from a phone on the same Wi-Fi; there is no login, so only do that at home.
const host = process.env.HOST ?? '127.0.0.1';

const app = buildApp({
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(root, 'data')),
  backupDir: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : undefined,
  webDir: path.join(root, 'dist'),
  logger: true,
});

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
