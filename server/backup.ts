import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './db.js';

// Writes a consistent copy of the database plus every photo into a new
// timestamped folder. Point BACKUP_DIR at a synced folder (iCloud Drive,
// Google Drive) to get an off-laptop copy.
export async function backup(db: DB, photosDir: string, backupDir: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = path.join(backupDir, `depop-manager-${stamp}`);
  fs.mkdirSync(path.join(target, 'photos'), { recursive: true });
  await db.backup(path.join(target, 'depop-manager.db'));
  const photos = fs.readdirSync(photosDir);
  for (const f of photos) fs.copyFileSync(path.join(photosDir, f), path.join(target, 'photos', f));
  return { path: target, photo_count: photos.length, created_at: new Date().toISOString() };
}
