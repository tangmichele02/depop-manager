import { useEffect, useState } from 'react';
import { Sheet, focusNewRow } from './Sheet';
import { ItemEditor } from './ItemEditor';
import { Settings } from './Settings';

type Route = { page: 'inventory' } | { page: 'item'; id: number | 'new' } | { page: 'settings' };

function parseHash(hash: string): Route {
  const m = hash.match(/^#\/item\/(new|\d+)$/);
  if (m) return { page: 'item', id: m[1] === 'new' ? 'new' : Number(m[1]) };
  if (hash === '#/settings') return { page: 'settings' };
  return { page: 'inventory' };
}

export function navigate(hash: string) {
  window.location.hash = hash;
}

export function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">
          Depop Manager
        </a>
        <nav>
          <a href="#/" className={route.page === 'inventory' ? 'active' : ''}>
            Items
          </a>
          <a href="#/settings" className={route.page === 'settings' ? 'active' : ''}>
            Settings
          </a>
          <button type="button" className="button primary" onClick={focusNewRow}>
            Add item
          </button>
        </nav>
      </header>
      <main className="page">
        {route.page === 'inventory' && <Sheet />}
        {route.page === 'item' && <ItemEditor key={String(route.id)} id={route.id} />}
        {route.page === 'settings' && <Settings />}
      </main>
    </>
  );
}
