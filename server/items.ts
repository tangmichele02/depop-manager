import { z } from 'zod';
import type { DB } from './db.js';
import { IN_STORES, STATUSES, WILLINGNESS, type Item, type PriceChange } from '../shared/types.js';

const cents = z.number().int().min(0).nullable();
const score = z.number().int().min(1).max(5).nullable();
const text = z.string().trim().max(5000).nullable().transform((s) => (s === '' ? null : s));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const itemInput = z.object({
  title: z.string().trim().min(1).max(200),
  brand: text,
  category: text,
  size: text,
  condition: score,
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  source: text,
  acquired_on: date,
  retail_cents: cents,
  cost_cents: cents,
  list_cents: cents,
  floor_cents: cents,
  sold_cents: cents,
  shipping_cents: cents,
  shipping_paid_by: z.enum(['buyer', 'me']),
  boosted: z.boolean(),
  status: z.enum(STATUSES),
  rating: score,
  willingness: z.enum(WILLINGNESS).nullable().default(null),
  in_stores: z.enum(IN_STORES).nullable().default(null),
  tax_pct: z.number().min(0).max(25).nullable().default(null),
  group_id: z.number().int().positive().nullable(),
  description: text,
  depop_url: text,
  notes: text,
  listed_on: date,
  sold_on: date,
});
export type ItemInput = z.infer<typeof itemInput>;
export const itemPatch = itemInput.partial();

const ITEM_COLUMNS = Object.keys(itemInput.shape) as (keyof ItemInput)[];

const SELECT_ITEM = `
  SELECT i.*,
    (SELECT '/photos/' || p.filename FROM photos p WHERE p.item_id = i.id ORDER BY p.is_cover DESC, p.position LIMIT 1) AS cover_url,
    (SELECT COUNT(*) FROM photos p WHERE p.item_id = i.id) AS photo_count
  FROM items i`;

type Row = Omit<Item, 'tags' | 'boosted'> & { tags: string; boosted: number };

function fromRow(row: Row): Item {
  return { ...row, tags: JSON.parse(row.tags), boosted: row.boosted === 1 };
}

function toParams(input: Partial<ItemInput>) {
  const params: Record<string, unknown> = {};
  for (const key of ITEM_COLUMNS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (key === 'tags') params.tags = JSON.stringify(value);
    else if (key === 'boosted') params.boosted = value ? 1 : 0;
    else params[key] = value;
  }
  return params;
}

const today = () => new Date().toISOString().slice(0, 10);

// Fill in listed/sold dates the first time an item reaches that status.
function stampDates(input: Partial<ItemInput>, existing?: Item) {
  const out = { ...input };
  const status = input.status ?? existing?.status;
  if (status === 'listed' || status === 'sold') {
    if (!out.listed_on && !existing?.listed_on) out.listed_on = today();
  }
  if (status === 'sold' && !out.sold_on && !existing?.sold_on) out.sold_on = today();
  return out;
}

export interface ItemFilter {
  status?: string;
  group_id?: number;
  q?: string;
}

export function listItems(db: DB, filter: ItemFilter = {}): Item[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.status) {
    where.push('i.status = @status');
    params.status = filter.status;
  }
  if (filter.group_id) {
    where.push('i.group_id = @group_id');
    params.group_id = filter.group_id;
  }
  if (filter.q) {
    where.push(`(i.title LIKE @q OR i.brand LIKE @q OR i.tags LIKE @q OR i.source LIKE @q)`);
    params.q = `%${filter.q}%`;
  }
  const sql = `${SELECT_ITEM} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.updated_at DESC, i.id DESC`;
  return (db.prepare(sql).all(params) as Row[]).map(fromRow);
}

export function getItem(db: DB, id: number): Item | undefined {
  const row = db.prepare(`${SELECT_ITEM} WHERE i.id = ?`).get(id) as Row | undefined;
  return row && fromRow(row);
}

export function createItem(db: DB, input: ItemInput): Item {
  const params = toParams(stampDates(input));
  const cols = Object.keys(params);
  const info = db
    .prepare(`INSERT INTO items (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`)
    .run(params);
  return getItem(db, Number(info.lastInsertRowid))!;
}

export function updateItem(db: DB, id: number, patch: Partial<ItemInput>): Item | undefined {
  const existing = getItem(db, id);
  if (!existing) return undefined;
  const params = toParams(stampDates(patch, existing));
  const cols = Object.keys(params);
  db.transaction(() => {
    if ('list_cents' in params && params.list_cents !== existing.list_cents) {
      db.prepare(`INSERT INTO price_changes (item_id, old_cents, new_cents) VALUES (?, ?, ?)`).run(
        id,
        existing.list_cents,
        params.list_cents,
      );
    }
    if (cols.length) {
      db.prepare(
        `UPDATE items SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`,
      ).run({ ...params, id });
    }
  })();
  return getItem(db, id);
}

export function deleteItem(db: DB, id: number): boolean {
  return db.prepare(`DELETE FROM items WHERE id = ?`).run(id).changes > 0;
}

export function priceHistory(db: DB, itemId: number): PriceChange[] {
  return db
    .prepare(`SELECT * FROM price_changes WHERE item_id = ? ORDER BY changed_on, id`)
    .all(itemId) as PriceChange[];
}
