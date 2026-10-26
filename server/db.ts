import Database from 'better-sqlite3';

export type DB = Database.Database;

// Each entry upgrades the schema by one version; PRAGMA user_version tracks progress.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
  );

  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    size TEXT,
    condition INTEGER CHECK (condition BETWEEN 1 AND 5),
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT,
    acquired_on TEXT,
    retail_cents INTEGER,
    cost_cents INTEGER,
    list_cents INTEGER,
    floor_cents INTEGER,
    sold_cents INTEGER,
    shipping_cents INTEGER,
    shipping_paid_by TEXT NOT NULL DEFAULT 'buyer' CHECK (shipping_paid_by IN ('buyer', 'me')),
    boosted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sourced',
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    description TEXT,
    depop_url TEXT,
    notes TEXT,
    listed_on TEXT,
    sold_on TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX items_status ON items(status);
  CREATE INDEX items_group ON items(group_id);

  CREATE TABLE photos (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_cover INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'other'
  );
  CREATE INDEX photos_item ON photos(item_id);

  CREATE TABLE price_changes (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    changed_on TEXT NOT NULL DEFAULT (datetime('now')),
    old_cents INTEGER,
    new_cents INTEGER
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `ALTER TABLE items ADD COLUMN willingness TEXT CHECK (willingness IN ('eager', 'happy', 'right_price', 'unsure'));`,
  `ALTER TABLE items ADD COLUMN in_stores TEXT CHECK (in_stores IN ('yes', 'sold_out', 'discontinued', 'vintage'));`,
  `ALTER TABLE items ADD COLUMN tax_pct REAL CHECK (tax_pct BETWEEN 0 AND 25);`,
];

export function openDb(file: string): DB {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
