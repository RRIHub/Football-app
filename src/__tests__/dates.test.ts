import { describe, expect, it } from 'vitest';
import { dateForOffset, offsetFromInput, toInputValue } from '../state/dates';

describe('date picker helpers', () => {
  const today = new Date(2026, 8, 27, 15, 30); // 27 Sep 2026, local time

  it('turns picked dates into day offsets from today', () => {
    expect(offsetFromInput('2026-09-27', today)).toBe(0);
    expect(offsetFromInput('2026-09-20', today)).toBe(-7);
    expect(offsetFromInput('2027-01-01', today)).toBe(96);
    expect(offsetFromInput('2025-09-27', today)).toBe(-365);
    expect(offsetFromInput('not a date', today)).toBeNull();
  });

  it('round-trips offsets through the date input', () => {
    for (const o of [-400, -30, -1, 0, 1, 45, 400]) {
      expect(offsetFromInput(toInputValue(dateForOffset(o, today)), today)).toBe(o);
    }
    expect(toInputValue(dateForOffset(5, today))).toBe('2026-10-02');
  });
});
