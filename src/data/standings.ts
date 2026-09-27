import type { Match, StandingRow, TeamRef } from './types';

export function computeStandings(teams: TeamRef[], matches: Match[]): StandingRow[] {
  const rows = new Map<number, StandingRow>(
    teams.map((t) => [
      t.id,
      { position: 0, team: t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    ]),
  );
  for (const m of matches) {
    if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
    const home = rows.get(m.home.id);
    const away = rows.get(m.away.id);
    if (!home || !away) continue;
    for (const [row, gf, ga] of [
      [home, m.homeScore, m.awayScore],
      [away, m.awayScore, m.homeScore],
    ] as const) {
      row.played++;
      row.goalsFor += gf;
      row.goalsAgainst += ga;
      if (gf > ga) {
        row.won++;
        row.points += 3;
      } else if (gf === ga) {
        row.drawn++;
        row.points += 1;
      } else row.lost++;
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name),
  );
  sorted.forEach((r, i) => (r.position = i + 1));
  return sorted;
}
