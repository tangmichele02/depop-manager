import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app';

const ITEM = {
  title: 'Levi’s 501 jeans',
  brand: 'Levi’s',
  category: 'Jeans',
  size: 'W28',
  condition: 4,
  tags: ['denim', 'vintage'],
  source: 'Goodwill',
  acquired_on: '2026-10-01',
  retail_cents: 6800,
  cost_cents: 600,
  list_cents: 3800,
  floor_cents: 3000,
  sold_cents: null,
  shipping_cents: null,
  shipping_paid_by: 'buyer',
  boosted: false,
  status: 'photographed',
  rating: 4,
  group_id: null,
  description: null,
  depop_url: null,
  notes: null,
  listed_on: null,
  sold_on: null,
};

// Smallest valid PNG, for upload tests.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function multipart(files: { name: string; type: string; data: Buffer }[]) {
  const boundary = '----test' + Date.now();
  const parts = files.map((f) =>
    Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`,
      ),
      f.data,
      Buffer.from('\r\n'),
    ]),
  );
  return {
    payload: Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

let dataDir: string;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'depop-manager-'));
  app = buildApp({ dataDir });
});

afterEach(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('items', () => {
  it('creates, lists, filters and fetches an item', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/items', payload: ITEM });
    expect(created.statusCode).toBe(201);
    const item = created.json();
    expect(item).toMatchObject({ title: ITEM.title, tags: ['denim', 'vintage'], boosted: false, photo_count: 0 });

    expect((await app.inject('/api/items')).json()).toHaveLength(1);
    expect((await app.inject('/api/items?status=listed')).json()).toHaveLength(0);
    expect((await app.inject('/api/items?q=denim')).json()).toHaveLength(1);

    const detail = (await app.inject(`/api/items/${item.id}`)).json();
    expect(detail.photos).toEqual([]);
  });

  it('rejects bad input with a readable message', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/items', payload: { ...ITEM, rating: 9 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/^rating:/);
  });

  it('logs price changes and stamps listed and sold dates', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/api/items', payload: ITEM })).json();
    const today = new Date().toISOString().slice(0, 10);

    const listed = (
      await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { status: 'listed', list_cents: 3500 } })
    ).json();
    expect(listed.listed_on).toBe(today);

    const sold = (
      await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { status: 'sold', sold_cents: 3200, sold_on: null } })
    ).json();
    expect(sold.sold_on).toBe(today);

    const { price_history } = (await app.inject(`/api/items/${id}`)).json();
    expect(price_history).toMatchObject([{ old_cents: 3800, new_cents: 3500 }]);
  });

  it('stores how willing you are to sell, and rejects unknown values', async () => {
    const { id, willingness } = (await app.inject({ method: 'POST', url: '/api/items', payload: ITEM })).json();
    expect(willingness).toBeNull();
    const updated = (
      await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { willingness: 'right_price' } })
    ).json();
    expect(updated.willingness).toBe('right_price');
    const untouched = (await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { rating: 2 } })).json();
    expect(untouched.willingness).toBe('right_price');
    const bad = await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { willingness: 'maybe' } });
    expect(bad.statusCode).toBe(400);
  });

  it('returns 404 for a missing item', async () => {
    expect((await app.inject('/api/items/999')).statusCode).toBe(404);
  });
});

describe('photos', () => {
  it('uploads, sets the first as cover, reorders, and cleans up files', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/api/items', payload: ITEM })).json();
    const upload = await app.inject({
      method: 'POST',
      url: `/api/items/${id}/photos`,
      ...multipart([
        { name: 'front.png', type: 'image/png', data: PNG },
        { name: 'back.png', type: 'image/png', data: PNG },
      ]),
    });
    expect(upload.statusCode).toBe(201);
    const photos = upload.json();
    expect(photos.map((p: { is_cover: boolean }) => p.is_cover)).toEqual([true, false]);
    expect((await app.inject(photos[0].url)).statusCode).toBe(200);

    const reordered = (
      await app.inject({ method: 'PUT', url: `/api/items/${id}/photos/order`, payload: { ids: [photos[1].id, photos[0].id] } })
    ).json();
    expect(reordered.map((p: { id: number }) => p.id)).toEqual([photos[1].id, photos[0].id]);

    const covered = (await app.inject({ method: 'PATCH', url: `/api/photos/${photos[1].id}`, payload: { is_cover: true } })).json();
    expect(covered.find((p: { is_cover: boolean }) => p.is_cover).id).toBe(photos[1].id);

    const afterDelete = (await app.inject({ method: 'DELETE', url: `/api/photos/${photos[1].id}` })).json();
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].is_cover).toBe(true);

    await app.inject({ method: 'DELETE', url: `/api/items/${id}` });
    expect(fs.readdirSync(path.join(dataDir, 'photos'))).toEqual([]);
  });

  it('refuses files that are not images', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/api/items', payload: ITEM })).json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${id}/photos`,
      ...multipart([{ name: 'notes.txt', type: 'text/plain', data: Buffer.from('hi') }]),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('groups, fees, export and backup', () => {
  it('manages groups and keeps items when a group is removed', async () => {
    const groups = (await app.inject({ method: 'POST', url: '/api/groups', payload: { name: 'Denim' } })).json();
    const groupId = groups[0].id;
    expect((await app.inject({ method: 'POST', url: '/api/groups', payload: { name: 'Denim' } })).statusCode).toBe(409);

    const { id } = (await app.inject({ method: 'POST', url: '/api/items', payload: { ...ITEM, group_id: groupId } })).json();
    expect((await app.inject('/api/groups')).json()[0].item_count).toBe(1);

    await app.inject({ method: 'DELETE', url: `/api/groups/${groupId}` });
    expect((await app.inject(`/api/items/${id}`)).json().item.group_id).toBeNull();
  });

  it('saves fees and uses them in the CSV profit column', async () => {
    await app.inject({ method: 'POST', url: '/api/items', payload: { ...ITEM, status: 'sold', sold_cents: 3200, shipping_cents: 749 } });
    await app.inject({ method: 'PUT', url: '/api/settings/fees', payload: { processing_pct: 0, processing_fixed_cents: 0, boost_pct: 8 } });
    const csv = (await app.inject('/api/export.csv')).body;
    const [header, row] = csv.trim().split('\r\n');
    const cols = header.split(',');
    expect(row.split(',')[cols.indexOf('profit')]).toBe('26.00');
  });

  it('writes a backup folder with the database and photos', async () => {
    const res = (await app.inject({ method: 'POST', url: '/api/backup' })).json();
    expect(fs.existsSync(path.join(res.path, 'depop-manager.db'))).toBe(true);
    expect(fs.existsSync(path.join(res.path, 'photos'))).toBe(true);
  });
});
