import { useMemo, useState } from 'react';
import { countries } from './countries';

export function NationalityPicker({ value, onChange }: { value?: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const all = useMemo(countries, []);
  const q = query.trim().toLowerCase();
  const list = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  const selected = all.find((c) => c.code === value);
  return (
    <div className="nationality">
      {selected && (
        <p className="selected-country">
          <span aria-hidden>{selected.flag}</span> <strong>{selected.name}</strong>
        </p>
      )}
      <input
        className="input"
        type="search"
        placeholder="Search for your country…"
        aria-label="Search countries"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="country-pick" role="listbox" aria-label="Countries">
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              role="option"
              aria-selected={c.code === value}
              className={`chip ${c.code === value ? 'on' : ''}`}
              onClick={() => onChange(c.code)}
            >
              <span aria-hidden>{c.flag}</span> {c.name}
            </button>
          </li>
        ))}
        {!list.length && <li className="muted">No countries match “{query}”.</li>}
      </ul>
    </div>
  );
}
