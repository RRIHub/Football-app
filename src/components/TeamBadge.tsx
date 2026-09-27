import type { TeamRef } from '../data/types';

export function TeamBadge({ team, size = 28 }: { team: TeamRef | undefined; size?: number }) {
  if (!team) return <span className="badge" style={{ width: size, height: size }} />;
  if (team.crest)
    return <img className="crest" src={team.crest} alt="" width={size} height={size} loading="lazy" />;
  return (
    <span
      className="badge"
      style={{ width: size, height: size, background: team.color, fontSize: size * 0.32 }}
      aria-hidden
    >
      {team.tla}
    </span>
  );
}
