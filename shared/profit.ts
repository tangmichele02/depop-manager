import type { FeeSettings, ShippingPaidBy } from './types.js';

export interface SaleInput {
  sold_cents: number | null;
  cost_cents: number | null;
  shipping_cents: number | null;
  shipping_paid_by: ShippingPaidBy;
  boosted: boolean;
  tax_pct?: number | null;
}

export interface ProfitBreakdown {
  sold_cents: number;
  cost_cents: number; // what you paid, including sales tax
  tax_cents: number;
  processing_cents: number;
  boost_cents: number;
  shipping_cost_cents: number;
  profit_cents: number;
}

// Sales tax on a purchase. A blank per-item rate falls back to the default.
export function purchaseTax(cost_cents: number | null, tax_pct: number | null | undefined, fees: FeeSettings): number {
  if (cost_cents == null) return 0;
  return Math.round((cost_cents * (tax_pct ?? fees.sales_tax_pct)) / 100);
}

export function paidWithTax(cost_cents: number | null, tax_pct: number | null | undefined, fees: FeeSettings) {
  return cost_cents == null ? null : cost_cents + purchaseTax(cost_cents, tax_pct, fees);
}

// US Depop fees: processing is charged on item price plus shipping, a boost fee
// on the item price only, and shipping is a cost only when the seller pays it.
export function profitFor(sale: SaleInput, fees: FeeSettings): ProfitBreakdown | null {
  if (sale.sold_cents == null) return null;
  const sold = sale.sold_cents;
  const shipping = sale.shipping_cents ?? 0;
  const tax = purchaseTax(sale.cost_cents, sale.tax_pct, fees);
  const cost = (sale.cost_cents ?? 0) + tax;
  const processing = Math.round(((sold + shipping) * fees.processing_pct) / 100) + fees.processing_fixed_cents;
  const boost = sale.boosted ? Math.round((sold * fees.boost_pct) / 100) : 0;
  // When the buyer pays, shipping passes through; when the seller pays, it comes out of the sale.
  const shippingCost = sale.shipping_paid_by === 'me' ? shipping : 0;
  return {
    sold_cents: sold,
    cost_cents: cost,
    tax_cents: tax,
    processing_cents: processing,
    boost_cents: boost,
    shipping_cost_cents: shippingCost,
    profit_cents: sold - cost - processing - boost - shippingCost,
  };
}

// What Depop pays out if the item sells at this price: the price minus
// processing (and the boost fee, and shipping if you pay it). Cost isn't
// subtracted; that's what profit is for.
export function payoutAt(
  price_cents: number | null,
  sale: Omit<SaleInput, 'sold_cents' | 'cost_cents' | 'tax_pct'>,
  fees: FeeSettings,
): number | null {
  const p = profitFor({ ...sale, sold_cents: price_cents, cost_cents: 0, tax_pct: 0 }, fees);
  return p && p.profit_cents;
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
