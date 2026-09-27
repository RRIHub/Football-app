// Local-calendar day arithmetic for date pickers (offsets are days from today).

const MS_PER_DAY = 86_400_000;

function localMidnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** The local date `offset` days from `today`. */
export function dateForOffset(offset: number, today = new Date()): Date {
  const d = localMidnight(today);
  d.setDate(d.getDate() + offset);
  return d;
}

/** "YYYY-MM-DD" (local) for an <input type="date">. */
export function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days from today to a "YYYY-MM-DD" value, or null if it isn't a valid date. */
export function offsetFromInput(value: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  // Round, because a daylight-saving change makes a day 23 or 25 hours long.
  return Math.round((d.getTime() - localMidnight(today).getTime()) / MS_PER_DAY);
}
