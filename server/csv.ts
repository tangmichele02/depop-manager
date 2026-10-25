import { formatCents, profitFor } from '../shared/profit.js';
import { WILLINGNESS_LABELS, type FeeSettings, type Group, type Item } from '../shared/types.js';

const dollars = (c: number | null) => (c == null ? '' : formatCents(c).replace('$', '').replace('−', '-'));

function cell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per item, with money in plain dollars so spreadsheets read it as numbers.
export function itemsCsv(items: Item[], groups: Group[], fees: FeeSettings): string {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const header = [
    'id', 'title', 'brand', 'category', 'size', 'condition', 'rating', 'willingness', 'group', 'tags', 'status', 'source',
    'acquired_on', 'retail', 'cost', 'list_price', 'floor_price', 'sold_price', 'shipping', 'shipping_paid_by',
    'boosted', 'profit', 'listed_on', 'sold_on', 'depop_url', 'notes',
  ];
  const rows = items.map((i) => [
    i.id, i.title, i.brand, i.category, i.size, i.condition, i.rating, i.willingness ? WILLINGNESS_LABELS[i.willingness] : '',
    i.group_id ? groupName.get(i.group_id) : '', i.tags.join('; '), i.status, i.source, i.acquired_on,
    dollars(i.retail_cents), dollars(i.cost_cents), dollars(i.list_cents), dollars(i.floor_cents),
    dollars(i.sold_cents), dollars(i.shipping_cents), i.shipping_paid_by, i.boosted ? 'yes' : 'no',
    dollars(profitFor(i, fees)?.profit_cents ?? null), i.listed_on, i.sold_on, i.depop_url, i.notes,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
