import { describe, expect, it } from 'vitest';
import { descriptionTemplate, hashtags, titleChecks } from '../shared/listing';

const base = { brand: "Levi's", category: 'Jeans', size: 'W28', condition: 4, tags: ['90s', 'mom jeans', 'vintage'] };

describe('titleChecks', () => {
  it('passes a title that follows the formula', () => {
    const checks = titleChecks({ ...base, title: "Levi's 90s 501 mom jeans light wash" });
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it('flags a vague title', () => {
    const failed = titleChecks({ ...base, title: 'CUTE RARE PANTS' })
      .filter((c) => !c.ok)
      .map((c) => c.label);
    expect(failed).toHaveLength(5);
  });

  it('does not ask for a brand or category the item lacks', () => {
    const checks = titleChecks({ ...base, brand: null, category: null, title: 'Y2K butterfly print baby tee white' });
    expect(checks.slice(0, 2).every((c) => c.ok)).toBe(true);
  });
});

describe('description helpers', () => {
  it('turns tags into at most five clean hashtags', () => {
    expect(hashtags(['Mom Jeans', '90s', '90s', 'y2k', 'a', 'b', 'c'])).toEqual(['#momjeans', '#90s', '#y2k', '#a', '#b']);
  });

  it('starts the description with the title and fills known fields', () => {
    const text = descriptionTemplate({ ...base, title: "Levi's 90s 501 mom jeans" });
    const lines = text.split('\n');
    expect(lines[0]).toBe("Levi's 90s 501 mom jeans");
    expect(text).toContain('Size: W28');
    expect(text).toContain('Condition: Like new');
    expect(lines.at(-1)).toBe('#90s #momjeans #vintage');
  });
});
