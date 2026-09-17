import { useEffect, useMemo, useState } from 'react';
import type { Formation, GameState, Mentality, Pressing, Tempo, DefensiveLine, Width } from './domain/types';
import { clubOrder } from './data/initialWorld';
import { createCareer, getNextFixture, playNextRound } from './game/career';
import { deleteGame, loadGame, saveGame } from './storage/gameStorage';

const tabs = ['Overview', 'Squad', 'Tactics', 'Table'] as const;
type Tab = (typeof tabs)[number];

function App() {
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const [tab, setTab] = useState<Tab>('Overview');
  const [managerName, setManagerName] = useState('');
  const [selectedClub, setSelectedClub] = useState(clubOrder[5]);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  const startCareer = () => {
    setGame(createCareer(managerName, selectedClub));
    setTab('Overview');
  };

  const continueCareer = () => {
    const saved = loadGame();
    if (saved) setGame(saved);
  };

  const resetCareer = () => {
    deleteGame();
    setGame(null);
  };

  if (!game) {
    return (
      <StartScreen
        managerName={managerName}
        setManagerName={setManagerName}
        selectedClub={selectedClub}
        setSelectedClub={setSelectedClub}
        onStart={startCareer}
        onContinue={continueCareer}
      />
    );
  }

  const club = game.clubs[game.clubId];
  const nextFixture = getNextFixture(game);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">DT</div>
          <div>
            <strong>Dream Team</strong>
            <span>Football Manager Simulation</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span>Season {game.season}</span>
          <span>Round {game.currentRound}</span>
          <span>{game.managerName}</span>
          <button className="ghost-button" onClick={resetCareer}>New Career</button>
        </div>
      </header>

      <main className="content">
        <section className="club-header card">
          <div>
            <div className="eyebrow">YOUR CLUB</div>
            <h1>{club.name}</h1>
            <p>{club.city} · Reputation {club.reputation}</p>
          </div>
          <div className="budget-block">
            <span>Transfer budget</span>
            <strong>{formatMoney(club.budget)}</strong>
          </div>
        </section>

        <nav className="tabs" aria-label="Game sections">
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? 'tab active' : 'tab'}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === 'Overview' && (
          <Overview
            game={game}
            nextFixture={nextFixture}
            onPlay={() => setGame(playNextRound(game))}
          />
        )}
        {tab === 'Squad' && <Squad game={game} />}
        {tab === 'Tactics' && (
          <Tactics game={game} onChange={(tactic) => setGame({ ...game, clubs: { ...game.clubs, [club.id]: { ...club, tactic } } })} />
        )}
        {tab === 'Table' && <LeagueTable game={game} />}
      </main>
    </div>
  );
}

function StartScreen(props: {
  managerName: string;
  setManagerName: (value: string) => void;
  selectedClub: string;
  setSelectedClub: (value: string) => void;
  onStart: () => void;
  onContinue: () => void;
}) {
  const saved = loadGame();
  const world = createClubLabels();

  return (
    <div className="start-screen">
      <div className="start-panel">
        <div className="hero-badge">DT</div>
        <div className="eyebrow">BROWSER FOOTBALL SIMULATION</div>
        <h1>Build your <span>Dream Team.</span></h1>
        <p className="hero-copy">
          Manage a club, shape your tactics, simulate every match and write your own football history over the seasons.
        </p>

        <div className="form-grid">
          <label>
            Manager name
            <input value={props.managerName} onChange={(event) => props.setManagerName(event.target.value)} placeholder="Your name" maxLength={30} />
          </label>
          <label>
            Start with
            <select value={props.selectedClub} onChange={(event) => props.setSelectedClub(event.target.value)}>
              {clubOrder.map((id) => <option key={id} value={id}>{world[id]}</option>)}
            </select>
          </label>
        </div>

        <button className="primary-button full" onClick={props.onStart}>Start career</button>
        {saved && (
          <button className="secondary-button full" onClick={props.onContinue}>
            Continue {saved.clubs[saved.clubId]?.name} · Season {saved.season}
          </button>
        )}
        <div className="starter-note">
          MVP: automatic match simulation · league table · squad · tactics · local save
        </div>
      </div>
    </div>
  );
}

function Overview({ game, nextFixture, onPlay }: { game: GameState; nextFixture?: ReturnType<typeof getNextFixture>; onPlay: () => void }) {
  const club = game.clubs[game.clubId];
  const lastMatch = game.lastMatch;
  const currentTablePosition = Math.max(1, game.table.findIndex((row) => row.teamId === game.clubId) + 1);
  const opponentId = nextFixture ? (nextFixture.homeTeamId === game.clubId ? nextFixture.awayTeamId : nextFixture.homeTeamId) : undefined;
  const opponent = opponentId ? game.clubs[opponentId] : undefined;
  const home = nextFixture?.homeTeamId === game.clubId;

  return (
    <div className="dashboard-grid">
      <section className="card next-match">
        <div className="section-title-row">
          <div>
            <div className="eyebrow">NEXT MATCH</div>
            <h2>{nextFixture ? `Matchday ${game.currentRound}` : 'Season complete'}</h2>
          </div>
          <span className="match-tag">{home ? 'HOME' : 'AWAY'}</span>
        </div>
        {opponent ? (
          <>
            <div className="fixture-line">
              <div className="team-side"><div className="team-badge" style={{ background: clubColor(club) }}>{club.shortName}</div><strong>{club.name}</strong></div>
              <div className="vs">VS</div>
              <div className="team-side"><div className="team-badge" style={{ background: clubColor(opponent) }}>{opponent.shortName}</div><strong>{opponent.name}</strong></div>
            </div>
            <button className="primary-button full" onClick={onPlay}>Simulate matchday</button>
          </>
        ) : (
          <div className="empty-state">No scheduled match remains in this season.</div>
        )}
      </section>

      <section className="card stat-card">
        <div className="eyebrow">SEASON SNAPSHOT</div>
        <div className="stat-grid">
          <Stat label="Table position" value={`${currentTablePosition}`} suffix="th" />
          <Stat label="Played" value={`${game.table.find((row) => row.teamId === game.clubId)?.played ?? 0}`} />
          <Stat label="Wins" value={`${game.table.find((row) => row.teamId === game.clubId)?.wins ?? 0}`} />
          <Stat label="Points" value={`${game.table.find((row) => row.teamId === game.clubId)?.points ?? 0}`} />
        </div>
      </section>

      <section className="card last-match-card">
        <div className="eyebrow">LATEST RESULT</div>
        {lastMatch ? (
          <div className="latest-result">
            <div>{game.clubs[lastMatch.homeTeamId]?.shortName}</div>
            <strong>{lastMatch.homeGoals} — {lastMatch.awayGoals}</strong>
            <div>{game.clubs[lastMatch.awayTeamId]?.shortName}</div>
          </div>
        ) : <div className="empty-state">Your first match is waiting.</div>}
        {lastMatch && (
          <div className="mini-stats">
            <span>xG {lastMatch.homeXg.toFixed(2)} — {lastMatch.awayXg.toFixed(2)}</span>
            <span>Possession {lastMatch.homePossession}% — {lastMatch.awayPossession}%</span>
            <span>Shots {lastMatch.homeShots} — {lastMatch.awayShots}</span>
          </div>
        )}
      </section>

      <section className="card events-card">
        <div className="section-title-row"><div><div className="eyebrow">MATCH EVENTS</div><h2>Timeline</h2></div></div>
        {lastMatch ? <EventTimeline game={game} /> : <div className="empty-state">Simulate your first match to see live-style events here.</div>}
      </section>
    </div>
  );
}

function EventTimeline({ game }: { game: GameState }) {
  if (!game.lastMatch) return null;
  return (
    <div className="timeline">
      {game.lastMatch.events.slice(-12).map((event) => (
        <div className="timeline-item" key={event.id}>
          <span className="minute">{event.minute}'</span>
          <span className={`event-dot ${event.type}`} />
          <span>{event.description}</span>
        </div>
      ))}
    </div>
  );
}

function Squad({ game }: { game: GameState }) {
  const club = game.clubs[game.clubId];
  const players = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  return (
    <section className="card">
      <div className="section-title-row"><div><div className="eyebrow">FIRST TEAM</div><h2>Squad</h2></div><span className="muted">{players.length} players</span></div>
      <div className="player-list">
        {players.map((player, index) => (
          <div className="player-row" key={player.id}>
            <div className="player-number">{index + 1}</div>
            <div className="player-main"><strong>{player.name}</strong><span>{player.position} · {player.preferredFoot === 'L' ? 'Left' : 'Right'} foot</span></div>
            <div className="player-metric"><span>OVR</span><strong>{player.overall}</strong></div>
            <div className="player-metric"><span>FIT</span><strong>{Math.round(player.fitness)}</strong></div>
            <div className="player-metric"><span>FORM</span><strong>{player.form >= 0 ? '+' : ''}{player.form}</strong></div>
            <div className="player-value">{formatMoney(player.value)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tactics({ game, onChange }: { game: GameState; onChange: (tactic: typeof game.clubs[string]['tactic']) => void }) {
  const tactic = game.clubs[game.clubId].tactic;
  const fields: Array<[string, keyof typeof tactic, string[]]> = [
    ['Formation', 'formation', ['4-3-3', '4-4-2', '4-2-3-1']],
    ['Mentality', 'mentality', ['Very Defensive', 'Defensive', 'Balanced', 'Attacking', 'Very Attacking']],
    ['Tempo', 'tempo', ['Slow', 'Normal', 'Fast']],
    ['Pressing', 'pressing', ['Low', 'Medium', 'High']],
    ['Defensive line', 'defensiveLine', ['Low', 'Normal', 'High']],
    ['Width', 'width', ['Narrow', 'Balanced', 'Wide']],
  ];

  return (
    <section className="card">
      <div className="section-title-row"><div><div className="eyebrow">MATCH PLAN</div><h2>Tactics</h2></div><span className="muted">Changes apply to the next simulation</span></div>
      <div className="tactic-grid">
        {fields.map(([label, key, options]) => (
          <label key={key} className="tactic-field">
            {label}
            <select value={tactic[key]} onChange={(event) => onChange({ ...tactic, [key]: event.target.value as never })}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="tactic-explainer">
        <strong>How it works</strong>
        <span>Attacking mentality and high pressing raise attacking pressure, while aggressive choices can reduce defensive stability and fitness.</span>
      </div>
    </section>
  );
}

function LeagueTable({ game }: { game: GameState }) {
  const rows = useMemo(() => [...game.table], [game.table]);
  return (
    <section className="card">
      <div className="section-title-row"><div><div className="eyebrow">DOMESTIC LEAGUE</div><h2>Table</h2></div><span className="muted">Season {game.season}</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Club</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const club = game.clubs[row.teamId];
              return <tr className={row.teamId === game.clubId ? 'your-club' : ''} key={row.teamId}>
                <td>{index + 1}</td><td><strong>{club.name}</strong></td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td>{row.goalsFor - row.goalsAgainst}</td><td><strong>{row.points}</strong></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return <div className="big-stat"><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>;
}

function createClubLabels(): Record<string, string> {
  return {
    northbridge: 'Northbridge FC',
    eastford: 'Eastford United',
    redharbor: 'Red Harbor',
    kingsport: 'Kingsport Athletic',
    rivergate: 'Rivergate City',
    oakvale: 'Oakvale Rovers',
    southbank: 'Southbank FC',
    lakeside: 'Lakeside Albion',
  };
}

function clubColor(club: { color: string }): string {
  return club.color;
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}m`;
  return `€${Math.round(value / 1000)}k`;
}

export default App;

void (null as unknown as Formation | Mentality | Tempo | Pressing | DefensiveLine | Width);
