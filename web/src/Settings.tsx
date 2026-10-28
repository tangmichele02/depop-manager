import { useEffect, useState } from 'react';
import { api } from './api';
import { formatCents, parseDollars } from '../../shared/profit';
import type { Group } from '../../shared/types';
import { useToast } from './shared-ui';

export function Settings() {
  const toast = useToast();
  return (
    <div className="stack narrow">
      <h1>Settings</h1>
      <GroupsPanel toast={toast} />
      <FeesPanel toast={toast} />
      <DataPanel toast={toast} />
      {toast.node}
    </div>
  );
}

type Toast = ReturnType<typeof useToast>;

function GroupsPanel({ toast }: { toast: Toast }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string; description: string } | null>(null);

  useEffect(() => {
    api.groups().then(setGroups).catch(toast.error);
  }, []);

  const run = async (p: Promise<Group[]>, done?: () => void) => {
    try {
      setGroups(await p);
      done?.();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <section className="panel">
      <h2>Groups</h2>
      <p className="muted">
        Groups say what an item is, like “Y2K going-out tops” or “Workwear”. Use them to plan themed drops.
      </p>
      {groups.length > 0 && (
        <ul className="group-list">
          {groups.map((g) =>
            editing?.id === g.id ? (
              <li key={g.id} className="group-edit">
                <input
                  id={`group-name-${g.id}`}
                  aria-label="Group name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
                <input
                  id={`group-desc-${g.id}`}
                  aria-label="Description"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
                <button
                  type="button"
                  className="button small primary"
                  onClick={() =>
                    run(api.updateGroup(g.id, editing.name, editing.description || null), () => setEditing(null))
                  }
                >
                  Save
                </button>
                <button type="button" className="button small" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </li>
            ) : (
              <li key={g.id}>
                <div>
                  <b>{g.name}</b>
                  {g.description && <span className="muted"> · {g.description}</span>}
                  <div className="muted small">
                    {g.item_count} {g.item_count === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="button small ghost"
                    onClick={() => setEditing({ id: g.id, name: g.name, description: g.description ?? '' })}
                  >
                    Rename
                  </button>
                  <button type="button" className="button small ghost" onClick={() => run(api.deleteGroup(g.id))}>
                    Remove
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(api.createGroup(name, description || null), () => {
            setName('');
            setDescription('');
          });
        }}
      >
        <input id="new-group-name" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          id="new-group-desc"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="button">
          Add group
        </button>
      </form>
      <p className="hint">Removing a group keeps its items; they just have no group.</p>
    </section>
  );
}

function FeesPanel({ toast }: { toast: Toast }) {
  const [pct, setPct] = useState('');
  const [fixed, setFixed] = useState('');
  const [boost, setBoost] = useState('');
  const [tax, setTax] = useState('');

  useEffect(() => {
    api
      .fees()
      .then((f) => {
        setPct(String(f.processing_pct));
        setFixed((f.processing_fixed_cents / 100).toFixed(2));
        setBoost(String(f.boost_pct));
        setTax(String(f.sales_tax_pct));
      })
      .catch(toast.error);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fixedCents = parseDollars(fixed);
    const p = Number(pct);
    const b = Number(boost);
    const t = Number(tax);
    if (fixedCents == null || Number.isNaN(fixedCents) || !Number.isFinite(p) || !Number.isFinite(b) || tax.trim() === '' || !Number.isFinite(t)) {
      return toast.error(new Error('Enter numbers for every field, like 3.3, 0.45, 8 and 10.55.'));
    }
    try {
      await api.saveFees({ processing_pct: p, processing_fixed_cents: fixedCents, boost_pct: b, sales_tax_pct: t });
      toast.show('Fees saved');
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <section className="panel">
      <h2>Fees and sales tax</h2>
      <p className="muted">
        Used for every profit figure. Defaults are Depop’s US fees as of mid-2026: no selling fee, payment processing of
        3.3% + $0.45 on item price plus shipping, and 8% on sales from boosted listings. Check Depop’s fee page if
        they change.
      </p>
      <form className="fees" onSubmit={save}>
        <label>
          Processing, percent
          <input id="fee-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
        </label>
        <label>
          Processing, fixed per order
          <span className="money">
            <span aria-hidden="true">$</span>
            <input id="fee-fixed" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
          </span>
        </label>
        <label>
          Boost fee, percent
          <input id="fee-boost" inputMode="decimal" value={boost} onChange={(e) => setBoost(e.target.value)} />
        </label>
        <label>
          Sales tax you pay when buying, percent
          <input id="fee-tax" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </label>
        <button type="submit" className="button primary">
          Save fees
        </button>
      </form>
      <p className="hint">
        Sales tax is added to what you paid for every item unless you set a different rate on that item. The default
        is Seattle’s 10.55%. In the sheet’s Tax % column you can pick Bellevue (10.3%) or No tax (0%), or type any
        other rate. Rates are from 2026 tax tables; check them if they change.
      </p>
      <p className="hint">Example: a {formatCents(3200)} sale with {formatCents(749)} shipping pays about {formatCents(Math.round(((3200 + 749) * Number(pct || 0)) / 100) + (parseDollars(fixed) || 0))} in processing.</p>
    </section>
  );
}

function DataPanel({ toast }: { toast: Toast }) {
  const [dir, setDir] = useState('');
  const [last, setLast] = useState<{ path: string; photo_count: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .backupInfo()
      .then((b) => setDir(b.backup_dir))
      .catch(toast.error);
  }, []);

  async function backup() {
    setBusy(true);
    try {
      setLast(await api.backup());
      toast.show('Backup saved');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Backup and export</h2>
      <p className="muted">
        Your inventory lives only on this laptop. A backup copies the database and every photo into a new folder in{' '}
        <code>{dir || '…'}</code>. To keep a copy off the laptop, start the app with <code>BACKUP_DIR</code> set to a
        folder in iCloud Drive or Google Drive.
      </p>
      <div className="row-actions">
        <button type="button" className="button primary" onClick={backup} disabled={busy}>
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
        <a className="button" href="/api/export.csv">
          Download CSV
        </a>
      </div>
      {last && (
        <p className="hint">
          Saved {last.photo_count} {last.photo_count === 1 ? 'photo' : 'photos'} and the database to <code>{last.path}</code>.
        </p>
      )}
      <p className="hint">The CSV opens in Google Sheets or Excel. It’s a snapshot for viewing, not something the app reads back.</p>
    </section>
  );
}
