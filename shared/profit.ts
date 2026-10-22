import type { FeeSettings, ShippingPaidBy } from './types.js';

export interface SaleInput {
  sold_cents: number | null;
  cost_cents: number | null;
  shipping_cents: number | null;
  shipping_paid_by: ShippingPaidBy;
  boosted: boolean;
}

export interface ProfitBreakdown {
  sold_cents: number;
  cost_cents: number;
  processing_cents: number;
  boost_cents: number;
  shipping_cost_cents: number;
  profit_cents: number;
}

// US Depop fees: processing is charged on item price plus shipping, a boost fee
// on the item price only, and shipping is a cost only when the seller pays it.
export function profitFor(sale: SaleInput, fees: FeeSettings): ProfitBreakdown | null {
  if (sale.sold_cents == null) return null;
  const sold = sale.sold_cents;
  const shipping = sale.shipping_cents ?? 0;
  const cost = sale.cost_cents ?? 0;
  const processing = Math.round(((sold + shipping) * fees.processing_pct) / 100) + fees.processing_fixed_cents;
  const boost = sale.boosted ? Math.round((sold * fees.boost_pct) / 100) : 0;
  // When the buyer pays, shipping passes through; when the seller pays, it comes out of the sale.
  const shippingCost = sale.shipping_paid_by === 'me' ? shipping : 0;
  return {
    sold_cents: sold,
    cost_cents: cost,
    processing_cents: processing,
    boost_cents: boost,
    shipping_cost_cents: shippingCost,
    profit_cents: sold - cost - processing - boost - shippingCost,
  };
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  const sign = cents < 0 ? '−' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Accepts "12", "12.5", "$12.50"; returns null for blank input and NaN for junk.
export function parseDollars(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return NaN;
  return Math.round(parseFloat(trimmed) * 100);
}
