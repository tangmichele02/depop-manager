import { useState } from 'react';
import { titleChecks, type ListingFields } from '../../shared/listing';

const STORAGE_KEY = 'naming-guide-open';

function readOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

// How to name and describe items so Depop search finds them.
export function NamingGuide() {
  const [open, setOpen] = useState(readOpen);
  return (
    <details
      className="guide"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        try {
          localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed');
        } catch {
          // Private windows can refuse storage; the guide just reopens next time.
        }
      }}
    >
      <summary>Naming guide</summary>
      <div className="guide-body">
        <div>
          <h3>Title formula</h3>
          <p className="formula">
            <span>Brand</span> + <span>style or era</span> + <span>item</span> + <span>color, fabric or fit</span>
          </p>
          <ul className="examples">
            <li>Levi’s 90s 501 mom jeans light wash</li>
            <li>Y2K butterfly print baby tee white</li>
            <li>Carhartt chore coat brown duck canvas</li>
          </ul>
        </div>
        <div>
          <h3>Why it works</h3>
          <ul>
            <li>Depop search weighs the first words most, so the title goes first in your description.</li>
            <li>Use the words a buyer would type: “mom jeans”, not “trousers”.</li>
            <li>Skip filler like cute, rare or L@@K, and don’t write in all caps.</li>
          </ul>
        </div>
        <div>
          <h3>In the description</h3>
          <ul>
            <li>Size on the tag and how it fits, plus measurements laid flat.</li>
            <li>Condition and every flaw, with a photo of each flaw.</li>
            <li>About five hashtags for style and brand. Skip size, color and condition, since Depop’s fields cover those.</li>
            <li>Fill in every Depop attribute (brand, color, style, fabric) to match the title.</li>
          </ul>
        </div>
      </div>
    </details>
  );
}

// "4/5" next to a title, with the missed checks in the tooltip.
export function TitleScore({ fields }: { fields: ListingFields }) {
  const checks = titleChecks(fields);
  const passed = checks.filter((c) => c.ok).length;
  const missed = checks.filter((c) => !c.ok).map((c) => c.label);
  return (
    <span
      className={`title-score ${passed === checks.length ? 'good' : ''}`}
      title={missed.length ? `To improve:\n• ${missed.join('\n• ')}` : 'Title follows the naming guide'}
    >
      {passed === checks.length ? '✓' : `${passed}/${checks.length}`}
    </span>
  );
}

export function TitleChecklist({ fields }: { fields: ListingFields }) {
  return (
    <ul className="title-checks">
      {titleChecks(fields).map((c) => (
        <li key={c.label} className={c.ok ? 'ok' : ''}>
          <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}
        </li>
      ))}
    </ul>
  );
}
