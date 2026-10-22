# Depop Manager

A small web app for running a Depop shop from your laptop. It tracks what each
item cost, what it's listed at, what it sold for, and the profit after Depop's
fees. It also keeps photos, ratings and groups. Everything stays on your
computer in a SQLite database.

Listing still happens on Depop. This app is the notebook beside it.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm start
```

Then open http://127.0.0.1:5174.

## Where your data lives

- `data/depop-manager.db` is the database.
- `data/photos/` holds the photos.

Both are ignored by git, so your inventory never ends up on GitHub.

Use **Settings → Back up now** to copy the database and photos into
`data/backups/`. To back up somewhere off the laptop, point the app at a synced
folder:

```sh
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Depop backups" npm start
```

**Settings → Download CSV** gives you a spreadsheet snapshot for Google Sheets
or Excel.

## Using it from your phone

By default the app only accepts connections from this laptop. To open it from a
phone on the same Wi-Fi, start it with `HOST=0.0.0.0 npm start` and visit
`http://<your laptop's IP>:5174`. There's no login, so only do this on a network
you trust.

## Development

```sh
npm run dev        # server on :5174, web app with hot reload on :5173
npm test
npm run typecheck
```

| Folder    | What's in it                                           |
| --------- | ------------------------------------------------------ |
| `server/` | Fastify API, SQLite schema and migrations, backup, CSV |
| `shared/` | Types and the profit calculation used by both sides    |
| `web/`    | React front end                                        |
| `test/`   | API and profit tests                                   |

Money is stored as whole cents. Fee defaults are Depop's US fees as of mid-2026
(3.3% + $0.45 processing on price plus shipping, 8% on boosted sales) and can be
changed in Settings.
