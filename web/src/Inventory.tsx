import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatCents, profitFor } from '../../shared/profit';
import { DEFAULT_FEES, STATUSES, type FeeSettings, type Group, type Item, type Status } from '../../shared/types';
import { Rating, STATUS_LABELS, StatusPill, useToast } from './shared-ui';
import { navigate } from './App';

type SortKey = 'updated' | 'rating' | 'list' | 'profit' | 'title';

const IN_STOCK: Status[] = ['sourced', 'prepped', 'photographed', 'drafted', 'listed'];

export function Inventory() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fees, setFees] = useState<FeeSettings>(DEFAULT_FEES);
  const [status, setStatus] = useState<Status | ''>('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
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

  const profit = (i: Item) => profitFor(i, fees)?.profit_cents ?? null;
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const summary = useMemo(() => {
    const all = items ?? [];
    const sold = all.filter((i) => i.status === 'sold');
    const stock = all.filter((i) => IN_STOCK.includes(i.status));
    return {
      stock: stock.length,
      listed: all.filter((i) => i.status === 'listed').length,
      sold: sold.length,
      profit: sold.reduce((sum, i) => sum + (profit(i) ?? 0), 0),
      tiedUp: stock.reduce((sum, i) => sum + (i.cost_cents ?? 0), 0),
      listValue: stock.reduce((sum, i) => sum + (i.list_cents ?? 0), 0),
    };
  }, [items, fees]);

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const i of items ?? []) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (items ?? []).filter(
      (i) =>
        (!status || i.status === status) &&
        (!groupId || i.group_id === groupId) &&
        (!needle ||
          [i.title, i.brand, i.size, i.source, ...i.tags].some((s) => s?.toLowerCase().includes(needle))),
    );
    const by: Record<SortKey, (a: Item, b: Item) => number> = {
      updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
      list: (a, b) => (b.list_cents ?? -1) - (a.list_cents ?? -1),
      profit: (a, b) => (profit(b) ?? -Infinity) - (profit(a) ?? -Infinity),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(by[sort]);
  }, [items, status, groupId, q, sort, fees]);

  return (
    <div className="stack">
      <section className="summary" aria-label="Shop summary">
        <div>
          <span className="label">In stock</span>
          <b>{summary.stock}</b>
          <span className="muted">{summary.listed} listed</span>
        </div>
        <div>
          <span className="label">Sold</span>
          <b>{summary.sold}</b>
        </div>
        <div>
          <span className="label">Profit from sales</span>
          <b className={summary.profit < 0 ? 'negative' : ''}>{formatCents(summary.profit)}</b>
        </div>
        <div>
          <span className="label">Spent on unsold stock</span>
          <b>{formatCents(summary.tiedUp)}</b>
          <span className="muted">listed at {formatCents(summary.listValue)}</span>
        </div>
      </section>

      <section className="filters" aria-label="Filters">
        <div className="chips" role="group" aria-label="Status">
          <button type="button" className={status === '' ? 'chip on' : 'chip'} onClick={() => setStatus('')}>
            All <span className="count">{items?.length ?? 0}</span>
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={status === s ? 'chip on' : 'chip'} onClick={() => setStatus(s)}>
              {STATUS_LABELS[s]} <span className="count">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filter-row">
          <input
            id="inventory-search"
            type="search"
            placeholder="Search title, brand, size, tag, source"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            id="inventory-group"
            aria-label="Group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select id="inventory-sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="updated">Recently changed</option>
            <option value="rating">Highest rated</option>
            <option value="list">Highest list price</option>
            <option value="profit">Most profit</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </section>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <h2>No items yet</h2>
          <p>Add the first piece you plan to sell. You can fill in prices and photos as you go.</p>
          <a className="button primary" href="#/item/new">
            Add item
          </a>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">No items match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="items">
            <thead>
              <tr>
                <th aria-label="Photo" />
                <th>Item</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Group</th>
                <th className="num">Cost</th>
                <th className="num">List</th>
                <th className="num">Sold</th>
                <th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const p = profit(i);
                return (
                  <tr key={i.id} onClick={() => navigate(`#/item/${i.id}`)}>
                    <td className="thumb">
                      {i.cover_url ? (
                        <img src={i.cover_url} alt="" loading="lazy" />
                      ) : (
                        <span className="no-photo" aria-hidden="true" />
                      )}
                    </td>
                    <td>
                      <a href={`#/item/${i.id}`} className="item-title" onClick={(e) => e.stopPropagation()}>
                        {i.title}
                      </a>
                      <div className="muted small">{[i.brand, i.size].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>
                      <StatusPill status={i.status} />
                    </td>
                    <td>
                      <Rating value={i.rating} />
                    </td>
                    <td>{i.group_id ? groupName.get(i.group_id) : <span className="muted">–</span>}</td>
                    <td className="num">{formatCents(i.cost_cents)}</td>
                    <td className="num">{formatCents(i.list_cents)}</td>
                    <td className="num">{formatCents(i.sold_cents)}</td>
                    <td className={`num ${p != null && p < 0 ? 'negative' : ''}`}>{formatCents(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {toast.node}
    </div>
  );
}
