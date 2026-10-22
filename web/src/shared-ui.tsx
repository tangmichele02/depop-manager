import { useEffect, useState } from 'react';
import type { Status } from '../../shared/types';

export const STATUS_LABELS: Record<Status, string> = {
  sourced: 'Sourced',
  prepped: 'Prepped',
  photographed: 'Photographed',
  drafted: 'Drafted',
  listed: 'Listed',
  sold: 'Sold',
  kept: 'Kept',
  donated: 'Donated',
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Rating({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">–</span>;
  return (
    <span className="rating" aria-label={`Rated ${value} of 5`}>
      {'★'.repeat(value)}
      <span className="rating-empty">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export function RatingInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="rating-input" id={id} role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          className={value != null && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Shows a message for a few seconds, e.g. "Saved".
export function useToast() {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.error ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [message]);
  const node = message && (
    <div className={`toast ${message.error ? 'error' : ''}`} role="status">
      {message.text}
    </div>
  );
  return {
    node,
    show: (text: string) => setMessage({ text }),
    error: (e: unknown) => setMessage({ text: e instanceof Error ? e.message : String(e), error: true }),
  };
}
