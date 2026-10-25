import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatCents, parseDollars, profitFor } from '../../shared/profit';
import { DEFAULT_FEES, STATUSES, type FeeSettings, type Group, type Item, type Status } from '../../shared/types';
import { STATUS_LABELS, useToast } from './shared-ui';
import { NamingGuide, TitleScore } from './NamingGuide';

const IN_STOCK: Status[] = ['sourced', 'prepped', 'photographed', 'drafted', 'listed'];

const MONEY_COLUMNS = [
  { key: 'retail_cents', label: 'Retail' },
  { key: 'cost_cents', label: 'Paid' },
  { key: 'list_cents', label: 'Listed at' },
  { key: 'sold_cents', label: 'Sold for' },
] as const;
type MoneyKey = (typeof MONEY_COLUMNS)[number]['key'];

const TEXT_COLUMNS = [
  { key: 'brand', label: 'Brand', className: 'cell-text' },
  { key: 'size', label: 'Size', className: 'cell-short' },
] as const;
type TextKey = 'title' | (typeof TEXT_COLUMNS)[number]['key'] | 'notes';

// Everything the API needs to create an item, with only a title filled in.
const blankItem = (title: string) => ({
  title,
  brand: null,
  category: null,
  size: null,
  condition: null,
  tags: [],
  source: null,
  acquired_on: null,
  retail_cents: null,
  cost_cents: null,
  list_cents: null,
  floor_cents: null,
  sold_cents: null,
  shipping_cents: null,
  shipping_paid_by: 'buyer',
  boosted: false,
  status: 'sourced',
  rating: null,
  group_id: null,
  description: null,
  depop_url: null,
  notes: null,
  listed_on: null,
  sold_on: null,
});

const dollarsText = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));

// "Add item" jumps to the blank row at the bottom of the sheet. When clicked
// from another page, the sheet does this once it has loaded.
let focusNewRowOnLoad = false;

export function focusNewRow() {
  const input = document.getElementById('new-item-title') as HTMLInputElement | null;
  if (input) {
    input.scrollIntoView({ block: 'center' });
    input.focus();
    return;
  }
  focusNewRowOnLoad = true;
  window.location.hash = '#/';
}

// Every item on one page as editable rows. Each cell saves when you leave it.
export function Sheet() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fees, setFees] = useState<FeeSettings>(DEFAULT_FEES);
  const [status, setStatus] = useState<Status | ''>('');
  const [q, setQ] = useState('');
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.items(), api.groups(), api.fees()])
      .then(([i, g, f]) => {
        setItems(i);
        setGroups(g);
        setFees(f);
      })
      .catch(toast.error);
  }, []);

  useEffect(() => {
    if (items !== null && focusNewRowOnLoad) {
      focusNewRowOnLoad = false;
      focusNewRow();
    }
  }, [items]);

  async function save(id: number, patch: Partial<Record<string, unknown>>) {
    try {
      const updated = await api.updateItem(id, patch);
      setItems((all) => all && all.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      toast.error(e);
    }
  }

  async function add(title: string) {
    try {
      const created = await api.createItem({ ...blankItem(title), status: status || 'sourced' });
      setItems((all) => [...(all ?? []), created]);
    } catch (e) {
      toast.error(e);
    }
  }

  // Oldest first, so rows stay put while you edit them.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? [])
      .filter(
        (i) =>
          (!status || i.status === status) &&
          (!needle || [i.title, i.brand, i.size, i.notes].some((s) => s?.toLowerCase().includes(needle))),
      )
      .sort((a, b) => a.id - b.id);
  }, [items, status, q]);

  const summary = useMemo(() => {
    const all = items ?? [];
    const sold = all.filter((i) => i.status === 'sold');
    return {
      total: all.length,
      stock: all.filter((i) => IN_STOCK.includes(i.status)).length,
      sold: sold.length,
      profit: sold.reduce((sum, i) => sum + (profitFor(i, fees)?.profit_cents ?? 0), 0),
    };
  }, [items, fees]);

  return (
    <div className="stack">
      <div className="sheet-head">
        <p className="sheet-summary">
          <b>{summary.total}</b> items · <b>{summary.stock}</b> in stock · <b>{summary.sold}</b> sold ·{' '}
          <b className={summary.profit < 0 ? 'negative' : ''}>{formatCents(summary.profit)}</b> profit
        </p>
        <div className="sheet-filters">
          <input
            id="sheet-search"
            type="search"
            placeholder="Search"
            aria-label="Search items"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select id="sheet-status" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <NamingGuide />

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="sheet">
            <thead>
              <tr>
                <th aria-label="Photo" />
                <th>Item</th>
                {TEXT_COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Status</th>
                <th>Rating</th>
                <th>Group</th>
                {MONEY_COLUMNS.map((c) => (
                  <th key={c.key} className="num">
                    {c.label}
                  </th>
                ))}
                <th className="num">Profit</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <Row key={i.id} item={i} groups={groups} fees={fees} onSave={save} onError={toast.error} />
              ))}
              <NewRow onAdd={add} />
            </tbody>
          </table>
        </div>
      )}
      {items !== null && shown.length === 0 && items.length > 0 && <p className="muted">No items match.</p>}
      <p className="hint">
        Changes save when you leave a cell. "Add item" jumps to the blank row at the bottom. Click a photo square to open the full item page for photos, dates, shipping and the full profit breakdown.
      </p>
      {toast.node}
    </div>
  );
}

function Row({
  item,
  groups,
  fees,
  onSave,
  onError,
}: {
  item: Item;
  groups: Group[];
  fees: FeeSettings;
  onSave: (id: number, patch: Record<string, unknown>) => void;
  onError: (e: unknown) => void;
}) {
  const profit = profitFor(item, fees)?.profit_cents ?? null;
  return (
    <tr>
      <td className="thumb">
        <a href={`#/item/${item.id}`} aria-label={`Open ${item.title}`} title="Open full item page">
          {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" /> : <span className="no-photo" />}
        </a>
      </td>
      <td>
        <div className="title-cell">
          <TextCell item={item} field="title" label="Item" required className="cell-wide" onSave={onSave} onError={onError} />
          <TitleScore fields={item} />
        </div>
      </td>
      {TEXT_COLUMNS.map((c) => (
        <td key={c.key}>
          <TextCell item={item} field={c.key} label={c.label} className={c.className} onSave={onSave} onError={onError} />
        </td>
      ))}
      <td>
        <select
          id={`status-${item.id}`}
          aria-label="Status"
          className={`cell status-${item.status}`}
          value={item.status}
          onChange={(e) => onSave(item.id, { status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          id={`rating-${item.id}`}
          aria-label="Rating"
          className="cell rating-cell"
          value={item.rating ?? ''}
          onChange={(e) => onSave(item.id, { rating: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">–</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          id={`group-${item.id}`}
          aria-label="Group"
          className="cell"
          value={item.group_id ?? ''}
          onChange={(e) => onSave(item.id, { group_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">–</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </td>
      {MONEY_COLUMNS.map((c) => (
        <td key={c.key} className="num">
          <MoneyCell item={item} field={c.key} label={c.label} onSave={onSave} onError={onError} />
        </td>
      ))}
      <td className={`num profit-cell ${profit != null && profit < 0 ? 'negative' : ''}`}>{formatCents(profit)}</td>
      <td>
        <TextCell item={item} field="notes" label="Notes" className="cell-notes" onSave={onSave} onError={onError} />
      </td>
    </tr>
  );
}

function TextCell({
  item,
  field,
  label,
  required,
  className = '',
  onSave,
  onError,
}: {
  item: Item;
  field: TextKey;
  label: string;
  required?: boolean;
  className?: string;
  onSave: (id: number, patch: Record<string, unknown>) => void;
  onError: (e: unknown) => void;
}) {
  const saved = item[field] ?? '';
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);

  function commit() {
    const next = value.trim();
    if (next === saved) return;
    if (required && !next) {
      setValue(saved);
      return onError(new Error(`${label} can’t be blank.`));
    }
    onSave(item.id, { [field]: next || null });
  }

  return (
    <input
      id={`${field}-${item.id}`}
      aria-label={label}
      className={`cell ${className}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function MoneyCell({
  item,
  field,
  label,
  onSave,
  onError,
}: {
  item: Item;
  field: MoneyKey;
  label: string;
  onSave: (id: number, patch: Record<string, unknown>) => void;
  onError: (e: unknown) => void;
}) {
  const saved = dollarsText(item[field]);
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const invalid = Number.isNaN(parseDollars(value));

  function commit() {
    const cents = parseDollars(value);
    if (Number.isNaN(cents)) return onError(new Error(`${label} must be a dollar amount, like 12 or 12.50.`));
    if (cents === item[field]) return setValue(saved);
    onSave(item.id, { [field]: cents });
  }

  return (
    <input
      id={`${field}-${item.id}`}
      aria-label={label}
      aria-invalid={invalid}
      inputMode="decimal"
      className={`cell cell-money ${invalid ? 'invalid' : ''}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function NewRow({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function commit() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    await onAdd(t);
    setTitle('');
    setBusy(false);
  }

  return (
    <tr className="new-row">
      <td className="thumb">
        <span className="no-photo add" aria-hidden="true">
          +
        </span>
      </td>
      <td colSpan={12}>
        <input
          id="new-item-title"
          aria-label="New item"
          className="cell cell-wide"
          placeholder="New item: brand + style + item + detail, then press Enter"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </td>
    </tr>
  );
}
