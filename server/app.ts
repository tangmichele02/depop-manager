import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { openDb } from './db.js';
import { createItem, deleteItem, getItem, itemInput, itemPatch, listItems, priceHistory, updateItem } from './items.js';
import { getFees, setFees } from './settings.js';
import { itemsCsv } from './csv.js';
import { backup } from './backup.js';
import { PHOTO_KINDS, STATUSES, type Group, type Photo } from '../shared/types.js';

export interface AppOptions {
  dataDir: string;
  backupDir?: string;
  webDir?: string; // built front end to serve, if present
  logger?: boolean;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function buildApp(opts: AppOptions) {
  const photosDir = path.join(opts.dataDir, 'photos');
  fs.mkdirSync(photosDir, { recursive: true });
  const dbFile = path.join(opts.dataDir, 'depop-manager.db');
  const db = openDb(dbFile);

  const app = Fastify({ logger: opts.logger ?? false });
  app.addHook('onClose', async () => db.close());

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({ error: `${first.path.join('.') || 'input'}: ${first.message}` });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "Something went wrong on the server" : (err as Error).message });
  });

  app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
  app.register(fastifyStatic, { root: photosDir, prefix: '/photos/', decorateReply: false });
  if (opts.webDir && fs.existsSync(opts.webDir)) {
    app.register(fastifyStatic, { root: opts.webDir, prefix: '/' });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }

  const photoUrl = (p: { filename: string }) => `/photos/${p.filename}`;
  const listPhotos = (itemId: number): Photo[] =>
    (
      db.prepare(`SELECT * FROM photos WHERE item_id = ? ORDER BY position, id`).all(itemId) as (Omit<
        Photo,
        'is_cover' | 'url'
      > & { is_cover: number })[]
    ).map((p) => ({ ...p, is_cover: p.is_cover === 1, url: photoUrl(p) }));

  const notFound = () => Object.assign(new Error('Item not found'), { statusCode: 404 });

  // Items

  app.get('/api/items', async (req) => {
    const q = z
      .object({
        status: z.enum(STATUSES).optional(),
        group_id: z.coerce.number().int().positive().optional(),
        q: z.string().optional(),
      })
      .parse(req.query);
    return listItems(db, q);
  });

  app.post('/api/items', async (req, reply) => {
    const item = createItem(db, itemInput.parse(req.body));
    return reply.code(201).send(item);
  });

  app.get('/api/items/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const item = getItem(db, id);
    if (!item) throw notFound();
    return { item, photos: listPhotos(id), price_history: priceHistory(db, id) };
  });

  app.patch('/api/items/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const item = updateItem(db, id, itemPatch.parse(req.body));
    if (!item) throw notFound();
    return item;
  });

  app.delete('/api/items/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const files = listPhotos(id).map((p) => p.filename);
    if (!deleteItem(db, id)) throw notFound();
    for (const f of files) fs.rmSync(path.join(photosDir, f), { force: true });
    return reply.code(204).send();
  });

  // Photos

  app.post('/api/items/:id/photos', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (!getItem(db, id)) throw notFound();
    for await (const part of req.files()) {
      const ext = IMAGE_TYPES[part.mimetype];
      if (!ext) {
        part.file.resume();
        throw Object.assign(new Error(`${part.filename} is not a JPEG, PNG, WebP or GIF image`), { statusCode: 400 });
      }
      const filename = `${randomUUID()}${ext}`;
      await pipeline(part.file, fs.createWriteStream(path.join(photosDir, filename)));
      if (part.file.truncated) {
        fs.rmSync(path.join(photosDir, filename), { force: true });
        throw Object.assign(new Error(`${part.filename} is larger than 25 MB`), { statusCode: 400 });
      }
      const { next, count } = db
        .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next, COUNT(*) AS count FROM photos WHERE item_id = ?`)
        .get(id) as { next: number; count: number };
      db
        .prepare(`INSERT INTO photos (item_id, filename, position, is_cover) VALUES (?, ?, ?, ?)`)
        .run(id, filename, next, count === 0 ? 1 : 0);
    }
    return reply.code(201).send(listPhotos(id));
  });

  app.put('/api/items/:id/photos/order', async (req) => {
    const { id } = idParam.parse(req.params);
    const { ids } = z.object({ ids: z.array(z.number().int()) }).parse(req.body);
    const current = listPhotos(id).map((p) => p.id);
    if (ids.length !== current.length || !current.every((p) => ids.includes(p))) {
      throw Object.assign(new Error('The order must list every photo of this item exactly once'), { statusCode: 400 });
    }
    const set = db.prepare(`UPDATE photos SET position = ? WHERE id = ? AND item_id = ?`);
    db.transaction(() => ids.forEach((pid, i) => set.run(i, pid, id)))();
    return listPhotos(id);
  });

  app.patch('/api/photos/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({ is_cover: z.literal(true).optional(), kind: z.enum(PHOTO_KINDS).optional() }).parse(req.body);
    const photo = db.prepare(`SELECT * FROM photos WHERE id = ?`).get(id) as { item_id: number } | undefined;
    if (!photo) throw Object.assign(new Error('Photo not found'), { statusCode: 404 });
    db.transaction(() => {
      if (body.is_cover) {
        db.prepare(`UPDATE photos SET is_cover = (id = ?) WHERE item_id = ?`).run(id, photo.item_id);
      }
      if (body.kind) db.prepare(`UPDATE photos SET kind = ? WHERE id = ?`).run(body.kind, id);
    })();
    return listPhotos(photo.item_id);
  });

  app.delete('/api/photos/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const photo = db.prepare(`SELECT * FROM photos WHERE id = ?`).get(id) as
      | { item_id: number; filename: string; is_cover: number }
      | undefined;
    if (!photo) throw Object.assign(new Error('Photo not found'), { statusCode: 404 });
    db.transaction(() => {
      db.prepare(`DELETE FROM photos WHERE id = ?`).run(id);
      if (photo.is_cover) {
        db.prepare(
          `UPDATE photos SET is_cover = 1 WHERE id = (SELECT id FROM photos WHERE item_id = ? ORDER BY position LIMIT 1)`,
        ).run(photo.item_id);
      }
    })();
    fs.rmSync(path.join(photosDir, photo.filename), { force: true });
    return listPhotos(photo.item_id);
  });

  // Groups

  const groupBody = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
  });
  const listGroups = () =>
    db
      .prepare(
        `SELECT g.*, (SELECT COUNT(*) FROM items i WHERE i.group_id = g.id) AS item_count FROM groups g ORDER BY g.name`,
      )
      .all() as Group[];
  const uniqueName = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw Object.assign(new Error('A group with that name already exists'), { statusCode: 409 });
      }
      throw e;
    }
  };

  app.get('/api/groups', async () => listGroups());

  app.post('/api/groups', async (req, reply) => {
    const g = groupBody.parse(req.body);
    uniqueName(() => db.prepare(`INSERT INTO groups (name, description) VALUES (?, ?)`).run(g.name, g.description ?? null));
    return reply.code(201).send(listGroups());
  });

  app.patch('/api/groups/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const g = groupBody.parse(req.body);
    uniqueName(() =>
      db.prepare(`UPDATE groups SET name = ?, description = ? WHERE id = ?`).run(g.name, g.description ?? null, id),
    );
    return listGroups();
  });

  app.delete('/api/groups/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
    return listGroups();
  });

  // Settings, export and backup

  app.get('/api/settings/fees', async () => getFees(db));

  app.put('/api/settings/fees', async (req) => {
    const fees = z
      .object({
        processing_pct: z.number().min(0).max(100),
        processing_fixed_cents: z.number().int().min(0),
        boost_pct: z.number().min(0).max(100),
      })
      .parse(req.body);
    setFees(db, fees);
    return fees;
  });

  app.get('/api/export.csv', async (_req, reply) => {
    const csv = itemsCsv(listItems(db), listGroups(), getFees(db));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="depop-manager-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  const backupDir = opts.backupDir ?? path.join(opts.dataDir, 'backups');
  app.get('/api/backup', async () => ({ backup_dir: backupDir }));
  app.post('/api/backup', async () => backup(db, photosDir, backupDir));

  return app;
}
