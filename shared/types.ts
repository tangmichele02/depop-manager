// Types shared by the server and the web app. Money is always whole cents.

export const STATUSES = [
  'sourced',
  'prepped',
  'photographed',
  'drafted',
  'listed',
  'sold',
  'kept',
  'donated',
] as const;
export type Status = (typeof STATUSES)[number];

export const PHOTO_KINDS = ['front', 'back', 'tag', 'flaw', 'modelled', 'other'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type ShippingPaidBy = 'buyer' | 'me';

// How ready you are to part with an item, separate from how well it will sell.
export const WILLINGNESS = ['eager', 'happy', 'right_price', 'unsure'] as const;
export type Willingness = (typeof WILLINGNESS)[number];
export const WILLINGNESS_LABELS: Record<Willingness, string> = {
  eager: 'Eager to sell',
  happy: 'Happy to sell',
  right_price: 'Only at my price',
  unsure: 'Not sure yet',
};

// Whether the brand still sells the item new. Sold-out pieces often resell for more.
export const IN_STORES = ['yes', 'sold_out', 'discontinued', 'vintage'] as const;
export type InStores = (typeof IN_STORES)[number];
export const IN_STORES_LABELS: Record<InStores, string> = {
  yes: 'Still in stores',
  sold_out: 'Sold out',
  discontinued: 'Discontinued',
  vintage: 'Vintage',
};

export interface Item {
  id: number;
  title: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: number | null; // 1–5
  tags: string[];
  source: string | null;
  acquired_on: string | null; // YYYY-MM-DD
  retail_cents: number | null;
  cost_cents: number | null;
  list_cents: number | null;
  floor_cents: number | null;
  sold_cents: number | null;
  shipping_cents: number | null;
  shipping_paid_by: ShippingPaidBy;
  boosted: boolean;
  status: Status;
  rating: number | null; // 1–5, expected sale potential
  willingness: Willingness | null;
  in_stores: InStores | null;
  group_id: number | null;
  description: string | null;
  depop_url: string | null;
  notes: string | null;
  listed_on: string | null;
  sold_on: string | null;
  created_at: string;
  updated_at: string;
  cover_url: string | null;
  photo_count: number;
}

export interface Photo {
  id: number;
  item_id: number;
  filename: string;
  position: number;
  is_cover: boolean;
  kind: PhotoKind;
  url: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  item_count: number;
}

export interface PriceChange {
  id: number;
  item_id: number;
  changed_on: string;
  old_cents: number | null;
  new_cents: number | null;
}

export interface FeeSettings {
  processing_pct: number; // e.g. 3.3
  processing_fixed_cents: number; // e.g. 45
  boost_pct: number; // e.g. 8
}

export const DEFAULT_FEES: FeeSettings = {
  processing_pct: 3.3,
  processing_fixed_cents: 45,
  boost_pct: 8,
};
