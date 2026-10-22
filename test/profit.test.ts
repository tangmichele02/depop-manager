import { describe, expect, it } from 'vitest';
import { formatCents, parseDollars, profitFor } from '../shared/profit';
import { DEFAULT_FEES } from '../shared/types';

describe('profitFor', () => {
  const base = { sold_cents: 3200, cost_cents: 600, shipping_cents: 749, shipping_paid_by: 'buyer' as const, boosted: false };

  it('matches the worked example in the plan', () => {
    // 3.3% of $39.49 = $1.30, plus $0.45 = $1.75; $32 − $6 − $1.75 = $24.25
    expect(profitFor(base, DEFAULT_FEES)).toMatchObject({ processing_cents: 175, profit_cents: 2425 });
  });

  it('takes 8% of the sale price for boosted sales', () => {
    expect(profitFor({ ...base, boosted: true }, DEFAULT_FEES)).toMatchObject({ boost_cents: 256, profit_cents: 2169 });
  });

  it('subtracts shipping when the seller pays it', () => {
    expect(profitFor({ ...base, shipping_paid_by: 'me' }, DEFAULT_FEES)?.profit_cents).toBe(2425 - 749);
  });

  it('returns null until the item has a sale price', () => {
    expect(profitFor({ ...base, sold_cents: null }, DEFAULT_FEES)).toBeNull();
  });
});

describe('money helpers', () => {
  it('parses dollar input', () => {
    expect(parseDollars('12')).toBe(1200);
    expect(parseDollars('$12.5')).toBe(1250);
    expect(parseDollars(' ')).toBeNull();
    expect(parseDollars('12.345')).toBeNaN();
    expect(parseDollars('abc')).toBeNaN();
  });

  it('formats cents', () => {
    expect(formatCents(2425)).toBe('$24.25');
    expect(formatCents(-256)).toBe('−$2.56');
    expect(formatCents(null)).toBe('');
  });
});
