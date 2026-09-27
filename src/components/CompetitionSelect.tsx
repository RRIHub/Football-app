import type { CompetitionCategory } from '../data/types';
import { useApp } from '../state/AppContext';

const GROUP_LABEL: Record<CompetitionCategory, string> = {
  domestic: 'Leagues',
  cup: 'Domestic cups',
  europe: 'Continental',
  international: 'International',
};

export function CompetitionSelect({
  value,
  onChange,
  allLabel,
  only,
}: {
  value: string;
  onChange: (code: string) => void;
  /** When set, adds an "all" option with value "ALL". */
  allLabel?: string;
  /** Restrict to these categories. */
  only?: CompetitionCategory[];
}) {
  const { competitions: all } = useApp();
  // Keep the list short: featured competitions plus whatever is selected. The
  // Leagues page's country browser reaches everything else.
  const competitions = all.filter((c) => c.featured || c.code === value);
  const cats = (only ?? (['domestic', 'cup', 'europe', 'international'] as CompetitionCategory[])).filter((cat) =>
    competitions.some((c) => c.category === cat),
  );
  return (
    <select className="input" aria-label="Competition" value={value} onChange={(e) => onChange(e.target.value)}>
      {allLabel && <option value="ALL">{allLabel}</option>}
      {cats.map((cat) => (
        <optgroup key={cat} label={GROUP_LABEL[cat]}>
          {competitions
            .filter((c) => c.category === cat)
            .map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
