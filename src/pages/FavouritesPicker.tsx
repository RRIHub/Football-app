import { useEffect, useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import { provider, type Team } from '../data';
import { followPlayer, followTeam, useApp, useCompetition, useTeam, type FollowedTeam } from '../state/AppContext';
import { useResource } from '../state/resource';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Two-step picker: favourite clubs, then favourite players from those clubs. */
export function FavouritesPicker({ welcomeName, onDone }: { welcomeName?: string; onDone: () => void }) {
  const [step, setStep] = useState<'clubs' | 'players'>('clubs');
  return step === 'clubs' ? (
    <ClubStep welcomeName={welcomeName} onNext={() => setStep('players')} />
  ) : (
    <PlayerStep onBack={() => setStep('clubs')} onDone={onDone} />
  );
}

function ClubStep({ welcomeName, onNext }: { welcomeName?: string; onNext: () => void }) {
  const { competitions, followedTeams } = useApp();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 350);
  const [code, setCode] = useState(competitions.find((c) => c.featured)?.code ?? competitions[0]?.code ?? '');
  const search = useResource<Team[]>(q.length >= 3 ? `search:${q.toLowerCase()}` : null, () => provider.searchTeams(q));
  const comp = useCompetition(q.length >= 3 ? null : code);
  const teams = q.length >= 3 ? search.data : comp.data?.competition.code === code ? comp.data.teams : undefined;
  const error = q.length >= 3 ? search.error : comp.error;

  return (
    <section className="panel picker-step">
      <p className="step-count muted small">Step 1 of 2</p>
      <h2>{welcomeName ? `Welcome, ${welcomeName}! Pick your favourite clubs` : 'Your favourite clubs'}</h2>
      <p className="muted">
        Follow as many clubs and national teams as you like, from any league, including lower divisions.
      </p>

      <SelectedTeams teams={followedTeams.items} onRemove={(t) => followedTeams.toggle(t)} />

      <div className="filters">
        <input
          className="input grow"
          type="search"
          placeholder="Search any club or country (3+ letters)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {q.length < 3 && <CompetitionSelect value={code} onChange={setCode} />}
      </div>

      {error && !teams ? (
        <ErrorBox message={error} />
      ) : !teams ? (
        <Loading what="teams" />
      ) : teams.length === 0 ? (
        <p className="muted">No teams found.</p>
      ) : (
        <div className="chip-grid">
          {teams.map((t) => (
            <button
              key={t.id}
              className={`chip ${followedTeams.isFollowing(t.id) ? 'on' : ''}`}
              aria-pressed={followedTeams.isFollowing(t.id)}
              onClick={() => followedTeams.toggle(followTeam(t))}
            >
              <TeamBadge team={t} size={20} /> {t.shortName}
              {q.length >= 3 && t.area && <span className="muted small"> · {t.area}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="step-actions">
        <button className="btn" onClick={onNext}>
          {followedTeams.items.length ? `Next: pick players (${followedTeams.items.length} clubs)` : 'Skip for now'}
        </button>
      </div>
    </section>
  );
}

function SelectedTeams({ teams, onRemove }: { teams: FollowedTeam[]; onRemove: (t: FollowedTeam) => void }) {
  if (!teams.length) return null;
  return (
    <div className="selected">
      <span className="label">Following</span>
      <div className="chip-grid">
        {teams.map((t) => (
          <button key={t.id} className="chip on" onClick={() => onRemove(t)} title="Unfollow">
            <TeamBadge team={t} size={20} /> {t.shortName} <span aria-hidden>×</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { followedTeams, followedPlayers } = useApp();
  const clubs = followedTeams.items.slice(0, 8);
  return (
    <section className="panel picker-step">
      <p className="step-count muted small">Step 2 of 2</p>
      <h2>Your favourite players</h2>
      <p className="muted">Tap players from your clubs' squads to follow their stats and transfers.</p>
      {followedPlayers.items.length > 0 && (
        <div className="selected">
          <span className="label">Following {followedPlayers.items.length} players</span>
          <div className="chip-grid">
            {followedPlayers.items.map((p) => (
              <button key={p.id} className="chip on" onClick={() => followedPlayers.toggle(p)} title="Unfollow">
                <TeamBadge team={p.team} size={20} /> {p.name} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {clubs.length === 0 && <p className="muted">Follow some clubs first to choose from their squads.</p>}
      {clubs.map((t) => (
        <Squad key={t.id} team={t} />
      ))}
      <div className="step-actions">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn" onClick={onDone}>
          Finish
        </button>
      </div>
    </section>
  );
}

const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;

function Squad({ team }: { team: FollowedTeam }) {
  const { followedPlayers } = useApp();
  const res = useTeam(team.id);
  const squad = [...(res.data?.squad ?? [])].sort((a, b) => ORDER[a.position] - ORDER[b.position] || a.name.localeCompare(b.name));
  return (
    <div className="squad-pick">
      <h3 className="row gap-sm">
        <TeamBadge team={team} size={22} /> {team.name}
      </h3>
      {res.error && !res.data ? (
        <p className="muted small">Couldn't load this squad.</p>
      ) : !res.data ? (
        <Loading what="squad" />
      ) : !squad.length ? (
        <p className="muted small">Squad not available.</p>
      ) : (
        <div className="chip-grid">
          {squad.map((p) => (
            <button
              key={p.id}
              className={`chip ${followedPlayers.isFollowing(p.id) ? 'on' : ''}`}
              aria-pressed={followedPlayers.isFollowing(p.id)}
              onClick={() => followedPlayers.toggle(followPlayer(p))}
            >
              <span className={`pos ${p.position}`}>{p.position}</span> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
