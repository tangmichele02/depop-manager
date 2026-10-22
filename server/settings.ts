import type { DB } from './db.js';
import { DEFAULT_FEES, type FeeSettings } from '../shared/types.js';

export function getFees(db: DB): FeeSettings {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'fees'`).get() as { value: string } | undefined;
  return row ? { ...DEFAULT_FEES, ...JSON.parse(row.value) } : DEFAULT_FEES;
}

export function setFees(db: DB, fees: FeeSettings) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('fees', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(fees));
}
