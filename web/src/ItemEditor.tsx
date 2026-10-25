import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { formatCents, parseDollars, profitFor } from '../../shared/profit';
import {
  DEFAULT_FEES,
  PHOTO_KINDS,
  STATUSES,
  WILLINGNESS,
  WILLINGNESS_LABELS,
  type FeeSettings,
  type Group,
  type Item,
  type Photo,
  type PriceChange,
  type ShippingPaidBy,
  type Status,
  type Willingness,
} from '../../shared/types';
import { RatingInput, STATUS_LABELS, useToast } from './shared-ui';
import { navigate } from './App';
import { NamingGuide, TitleChecklist } from './NamingGuide';
import { descriptionTemplate, type ListingFields } from '../../shared/listing';

const MONEY_FIELDS = ['retail_cents', 'cost_cents', 'list_cents', 'floor_cents', 'sold_cents', 'shipping_cents'] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];

interface Form {
  title: string;
  brand: string;
  category: string;
  size: string;
  condition: number | null;
  tags: string;
  source: string;
  acquired_on: string;
  status: Status;
  rating: number | null;
  willingness: Willingness | null;
  group_id: number | null;
  description: string;
  depop_url: string;
  notes: string;
  listed_on: string;
  sold_on: string;
  shipping_paid_by: ShippingPaidBy;
  boosted: boolean;
  money: Record<MoneyField, string>;
}

const dollarsText = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));

function toForm(i?: Item): Form {
  return {
    title: i?.title ?? '',
    brand: i?.brand ?? '',
    category: i?.category ?? '',
    size: i?.size ?? '',
    condition: i?.condition ?? null,
    tags: i?.tags.join(', ') ?? '',
    source: i?.source ?? '',
    acquired_on: i?.acquired_on ?? '',
    status: i?.status ?? 'sourced',
    rating: i?.rating ?? null,
    willingness: i?.willingness ?? null,
    group_id: i?.group_id ?? null,
    description: i?.description ?? '',
    depop_url: i?.depop_url ?? '',
    notes: i?.notes ?? '',
    listed_on: i?.listed_on ?? '',
    sold_on: i?.sold_on ?? '',
    shipping_paid_by: i?.shipping_paid_by ?? 'buyer',
    boosted: i?.boosted ?? false,
    money: Object.fromEntries(MONEY_FIELDS.map((f) => [f, dollarsText(i?.[f] ?? null)])) as Record<MoneyField, string>,
  };
}

function listingFields(f: Form): ListingFields {
  const blank = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    title: f.title,
    brand: blank(f.brand),
    category: blank(f.category),
    size: blank(f.size),
    condition: f.condition,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

const MONEY_LABELS: Record<MoneyField, string> = {
  retail_cents: 'Retail price',
  cost_cents: 'What you paid',
  list_cents: 'List price',
  floor_cents: 'Lowest offer you’ll accept',
  sold_cents: 'Sold for',
  shipping_cents: 'Shipping',
};

// Returns the API body, or an error message naming the bad field.
function toBody(f: Form): { body?: Record<string, unknown>; error?: string } {
  if (!f.title.trim()) return { error: 'Add a title before saving.' };
  const money: Record<string, number | null> = {};
  for (const field of MONEY_FIELDS) {
    const v = parseDollars(f.money[field]);
    if (Number.isNaN(v)) return { error: `${MONEY_LABELS[field]} must be a dollar amount, like 12 or 12.50.` };
    money[field] = v;
  }
  const blank = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    body: {
      title: f.title.trim(),
      brand: blank(f.brand),
      category: blank(f.category),
      size: blank(f.size),
      condition: f.condition,
      tags: f.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      source: blank(f.source),
      acquired_on: blank(f.acquired_on),
      status: f.status,
      rating: f.rating,
      willingness: f.willingness,
      group_id: f.group_id,
      description: blank(f.description),
      depop_url: blank(f.depop_url),
      notes: blank(f.notes),
      listed_on: blank(f.listed_on),
      sold_on: blank(f.sold_on),
      shipping_paid_by: f.shipping_paid_by,
      boosted: f.boosted,
      ...money,
    },
  };
}

export function ItemEditor({ id }: { id: number | 'new' }) {
  const isNew = id === 'new';
  const [form, setForm] = useState<Form>(toForm());
  const [loaded, setLoaded] = useState(isNew);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fees, setFees] = useState<FeeSettings>(DEFAULT_FEES);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.groups().then(setGroups).catch(toast.error);
    api.fees().then(setFees).catch(toast.error);
    if (!isNew) {
      api
        .item(id)
        .then((d) => {
          setForm(toForm(d.item));
          setPhotos(d.photos);
          setHistory(d.price_history);
          setLoaded(true);
        })
        .catch(toast.error);
    }
  }, [id]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setMoney = (field: MoneyField, value: string) => setForm((f) => ({ ...f, money: { ...f.money, [field]: value } }));

  const parsed = (field: MoneyField) => {
    const v = parseDollars(form.money[field]);
    return Number.isNaN(v) ? null : v;
  };
  const breakdown = profitFor(
    {
      sold_cents: parsed('sold_cents'),
      cost_cents: parsed('cost_cents'),
      shipping_cents: parsed('shipping_cents'),
      shipping_paid_by: form.shipping_paid_by,
      boosted: form.boosted,
    },
    fees,
  );
  const listCents = parsed('list_cents');
  const projected =
    !breakdown && listCents != null
      ? profitFor(
          {
            sold_cents: listCents,
            cost_cents: parsed('cost_cents'),
            shipping_cents: parsed('shipping_cents'),
            shipping_paid_by: form.shipping_paid_by,
            boosted: form.boosted,
          },
          fees,
        )
      : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { body, error } = toBody(form);
    if (error) return toast.error(new Error(error));
    setSaving(true);
    try {
      if (isNew) {
        const item = await api.createItem(body);
        navigate(`#/item/${item.id}`);
      } else {
        const item = await api.updateItem(id, body);
        setForm(toForm(item));
        setHistory((await api.item(id)).price_history);
        toast.show('Saved');
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew) return;
    try {
      await api.deleteItem(id);
      navigate('#/');
    } catch (err) {
      toast.error(err);
    }
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <form className="editor" onSubmit={save}>
      <div className="editor-head">
        <a href="#/" className="back">
          ← All items
        </a>
        <h1>{isNew ? 'New item' : form.title || 'Untitled item'}</h1>
        <div className="actions">
          {!isNew &&
            (confirmDelete ? (
              <>
                <span className="muted small">Delete this item and its photos?</span>
                <button type="button" className="button danger" onClick={remove}>
                  Delete
                </button>
                <button type="button" className="button" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className="button ghost" onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            ))}
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create item' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <div className="stack">
          <fieldset>
            <legend>The item</legend>
            <label className="wide">
              Title
              <input
                id="title"
                value={form.title}
                placeholder="Brand + style or era + item + color, fabric or fit"
                onChange={(e) => set('title', e.target.value)}
                required
              />
              <TitleChecklist fields={listingFields(form)} />
            </label>
            <label>
              Brand
              <input id="brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </label>
            <label>
              Category
              <input
                id="category"
                value={form.category}
                placeholder="Tops, jeans, jackets…"
                onChange={(e) => set('category', e.target.value)}
              />
            </label>
            <label>
              Size
              <input id="size" value={form.size} onChange={(e) => set('size', e.target.value)} />
            </label>
            <label>
              Condition
              <select
                id="condition"
                value={form.condition ?? ''}
                onChange={(e) => set('condition', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Not set</option>
                <option value="5">5 · New with tags</option>
                <option value="4">4 · Like new</option>
                <option value="3">3 · Good, light wear</option>
                <option value="2">2 · Fair, visible wear</option>
                <option value="1">1 · Flawed, priced to match</option>
              </select>
            </label>
            <label className="wide">
              Tags
              <input
                id="tags"
                value={form.tags}
                placeholder="y2k, denim, going-out"
                onChange={(e) => set('tags', e.target.value)}
              />
              <span className="hint">Separate with commas.</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Rating, willingness and group</legend>
            <label>
              How well you expect it to sell
              <RatingInput id="rating" value={form.rating} onChange={(v) => set('rating', v)} />
            </label>
            <label>
              How willing you are to sell it
              <select
                id="willingness"
                value={form.willingness ?? ''}
                onChange={(e) => set('willingness', (e.target.value || null) as Willingness | null)}
              >
                <option value="">Not set</option>
                {WILLINGNESS.map((w) => (
                  <option key={w} value={w}>
                    {WILLINGNESS_LABELS[w]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group
              <select
                id="group"
                value={form.group_id ?? ''}
                onChange={(e) => set('group_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {groups.length === 0 && (
                <span className="hint">
                  Create groups in <a href="#/settings">Settings</a>.
                </span>
              )}
            </label>
          </fieldset>

          <fieldset>
            <legend>Where it came from</legend>
            <label>
              Source
              <input
                id="source"
                value={form.source}
                placeholder="Goodwill on 3rd, my closet…"
                onChange={(e) => set('source', e.target.value)}
              />
            </label>
            <label>
              Bought on
              <input id="acquired_on" type="date" value={form.acquired_on} onChange={(e) => set('acquired_on', e.target.value)} />
            </label>
            <MoneyInput field="retail_cents" form={form} onChange={setMoney} />
            <MoneyInput field="cost_cents" form={form} onChange={setMoney} />
          </fieldset>

          <fieldset>
            <legend>Listing</legend>
            <label>
              Status
              <select id="status" value={form.status} onChange={(e) => set('status', e.target.value as Status)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Listed on
              <input id="listed_on" type="date" value={form.listed_on} onChange={(e) => set('listed_on', e.target.value)} />
            </label>
            <MoneyInput field="list_cents" form={form} onChange={setMoney} />
            <MoneyInput field="floor_cents" form={form} onChange={setMoney} />
            <label className="wide">
              Depop link
              <input
                id="depop_url"
                type="url"
                value={form.depop_url}
                placeholder="https://www.depop.com/products/…"
                onChange={(e) => set('depop_url', e.target.value)}
              />
            </label>
            <label className="wide">
              Description
              <textarea
                id="description"
                rows={10}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
              <span className="row-actions">
                {form.description ? (
                  <CopyButton text={form.description} />
                ) : (
                  <button
                    type="button"
                    className="button small"
                    onClick={() => set('description', descriptionTemplate(listingFields(form)))}
                  >
                    Start from template
                  </button>
                )}
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Sale</legend>
            <MoneyInput field="sold_cents" form={form} onChange={setMoney} />
            <label>
              Sold on
              <input id="sold_on" type="date" value={form.sold_on} onChange={(e) => set('sold_on', e.target.value)} />
            </label>
            <MoneyInput field="shipping_cents" form={form} onChange={setMoney} />
            <label>
              Shipping paid by
              <select
                id="shipping_paid_by"
                value={form.shipping_paid_by}
                onChange={(e) => set('shipping_paid_by', e.target.value as ShippingPaidBy)}
              >
                <option value="buyer">Buyer</option>
                <option value="me">Me</option>
              </select>
            </label>
            <label className="check wide">
              <input id="boosted" type="checkbox" checked={form.boosted} onChange={(e) => set('boosted', e.target.checked)} />
              Sold through a boosted listing
            </label>
          </fieldset>

          <fieldset>
            <legend>Notes</legend>
            <label className="wide">
              <span className="sr-only">Notes</span>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                placeholder="Flaws, measurements, ideas for the photos…"
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>
          </fieldset>
        </div>

        <aside className="stack">
          <NamingGuide />
          {isNew ? (
            <div className="panel">
              <h2>Photos</h2>
              <p className="muted">Create the item first, then add photos.</p>
            </div>
          ) : (
            <Photos itemId={id} photos={photos} setPhotos={setPhotos} onError={toast.error} />
          )}

          <div className="panel">
            <h2>{breakdown ? 'Profit' : 'Profit at list price'}</h2>
            <ProfitTable b={breakdown ?? projected} />
            <p className="hint">
              Fees: {fees.processing_pct}% + {formatCents(fees.processing_fixed_cents)} processing on price plus
              shipping{form.boosted ? `, ${fees.boost_pct}% boost fee` : ''}. Change them in <a href="#/settings">Settings</a>.
            </p>
          </div>

          {history.length > 0 && (
            <div className="panel">
              <h2>Price history</h2>
              <ul className="history">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="muted">{h.changed_on.slice(0, 10)}</span>
                    <span>
                      {h.old_cents == null ? 'Set to' : `${formatCents(h.old_cents)} →`} {formatCents(h.new_cents) || 'none'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
      {toast.node}
    </form>
  );
}

function MoneyInput({ field, form, onChange }: { field: MoneyField; form: Form; onChange: (f: MoneyField, v: string) => void }) {
  const invalid = Number.isNaN(parseDollars(form.money[field]));
  return (
    <label>
      {MONEY_LABELS[field]}
      <span className={`money ${invalid ? 'invalid' : ''}`}>
        <span aria-hidden="true">$</span>
        <input
          id={field}
          inputMode="decimal"
          value={form.money[field]}
          onChange={(e) => onChange(field, e.target.value)}
          aria-invalid={invalid}
        />
      </span>
    </label>
  );
}

function ProfitTable({ b }: { b: ReturnType<typeof profitFor> }) {
  if (!b) return <p className="muted">Add a list or sold price to see profit.</p>;
  return (
    <dl className="profit">
      <dt>Sale price</dt>
      <dd>{formatCents(b.sold_cents)}</dd>
      <dt>What you paid</dt>
      <dd>{formatCents(-b.cost_cents)}</dd>
      <dt>Processing fee</dt>
      <dd>{formatCents(-b.processing_cents)}</dd>
      {b.boost_cents > 0 && (
        <>
          <dt>Boost fee</dt>
          <dd>{formatCents(-b.boost_cents)}</dd>
        </>
      )}
      {b.shipping_cost_cents > 0 && (
        <>
          <dt>Shipping you paid</dt>
          <dd>{formatCents(-b.shipping_cost_cents)}</dd>
        </>
      )}
      <dt className="total">Profit</dt>
      <dd className={`total ${b.profit_cents < 0 ? 'negative' : ''}`}>{formatCents(b.profit_cents)}</dd>
    </dl>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="button small"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? 'Copied' : 'Copy description'}
    </button>
  );
}

function Photos({
  itemId,
  photos,
  setPhotos,
  onError,
}: {
  itemId: number;
  photos: Photo[];
  setPhotos: (p: Photo[]) => void;
  onError: (e: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const run = async (p: Promise<Photo[]>) => {
    try {
      setPhotos(await p);
    } catch (e) {
      onError(e);
    }
  };

  async function upload(files: FileList | File[]) {
    if (!files.length) return;
    setUploading(true);
    await run(api.uploadPhotos(itemId, files));
    setUploading(false);
  }

  function move(index: number, delta: number) {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    run(api.reorderPhotos(itemId, ids));
  }

  return (
    <div className="panel">
      <h2>Photos</h2>
      <div
        className={`dropzone ${dragging ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
      >
        <p>{uploading ? 'Uploading…' : 'Drop photos here'}</p>
        <button type="button" className="button small" onClick={() => input.current?.click()} disabled={uploading}>
          Choose files
        </button>
        <input
          ref={input}
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {photos.length > 0 && (
        <ul className="photo-grid">
          {photos.map((p, i) => (
            <li key={p.id} className={p.is_cover ? 'cover' : ''}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt={`Photo ${i + 1}`} />
              </a>
              {p.is_cover && <span className="cover-badge">Cover</span>}
              <div className="photo-tools">
                <select
                  id={`photo-kind-${p.id}`}
                  aria-label="Photo type"
                  value={p.kind}
                  onChange={(e) => run(api.updatePhoto(p.id, { kind: e.target.value }))}
                >
                  {PHOTO_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="photo-buttons">
                  <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    disabled={i === photos.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    →
                  </button>
                  {!p.is_cover && (
                    <button type="button" onClick={() => run(api.updatePhoto(p.id, { is_cover: true }))}>
                      Make cover
                    </button>
                  )}
                  <button type="button" aria-label="Delete photo" onClick={() => run(api.deletePhoto(p.id))}>
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
