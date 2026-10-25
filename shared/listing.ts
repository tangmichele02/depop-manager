// Listing-writing helpers. Depop's search weighs the first words of a listing
// most, so the title becomes the description's first line.

export interface ListingFields {
  title: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: number | null;
  tags: string[];
}

export interface TitleCheck {
  ok: boolean;
  label: string;
}

export const CONDITION_TEXT: Record<number, string> = {
  5: 'New with tags',
  4: 'Like new, worn once or twice',
  3: 'Good, light signs of wear',
  2: 'Fair, visible wear (see photos)',
  1: 'Flawed, priced to match (see photos)',
};

const FILLER = /\b(cute|nice|rare|must ?have|look|l@@k|omg|vibes?)\b/i;

const has = (haystack: string, needle: string | null) =>
  !!needle && haystack.toLowerCase().includes(needle.trim().toLowerCase());

// Simple checks shown next to the title. They're nudges, not rules.
export function titleChecks(f: ListingFields): TitleCheck[] {
  const t = f.title.trim();
  const letters = t.replace(/[^a-z]/gi, '');
  return [
    {
      ok: !f.brand || t.toLowerCase().startsWith(f.brand.trim().toLowerCase()),
      label: f.brand ? `Starts with the brand (${f.brand})` : 'Starts with the brand, if it has one',
    },
    {
      ok: !f.category || has(t, f.category.replace(/s$/i, '')),
      label: f.category ? `Says what it is (${f.category.toLowerCase()})` : 'Says what it is: jeans, baby tee, cardigan',
    },
    {
      ok: f.tags.some((tag) => has(t, tag)),
      label: 'Includes a style or era word buyers search, like y2k, 90s or vintage',
    },
    { ok: t.length >= 20 && t.length <= 70, label: 'Between 20 and 70 characters' },
    {
      ok: !FILLER.test(t) && !(letters.length > 4 && letters === letters.toUpperCase()),
      label: 'No filler (cute, rare, L@@K) or all caps',
    },
  ];
}

// Turns tags into Depop hashtags: lowercase, no spaces, at most five.
export function hashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const h = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h) seen.add(`#${h}`);
  }
  return [...seen].slice(0, 5);
}

// A fill-in-the-blanks description that follows the naming guide.
export function descriptionTemplate(f: ListingFields): string {
  const lines = [f.title.trim() || '[Brand] [style/era] [item] [color, fabric or fit]', ''];
  if (f.brand) lines.push(`Brand: ${f.brand}`);
  lines.push(`Size: ${f.size ?? '[size on the tag]'}, fits like [size]`);
  lines.push(`Condition: ${f.condition ? CONDITION_TEXT[f.condition] : '[condition]'}`);
  lines.push('Flaws: [none, or describe them and show them in a photo]');
  lines.push('Measurements (laid flat): pit to pit [ ] in, length [ ] in');
  lines.push('Material: [from the care tag]');
  const tags = hashtags(f.tags);
  if (tags.length) lines.push('', tags.join(' '));
  return lines.join('\n');
}
