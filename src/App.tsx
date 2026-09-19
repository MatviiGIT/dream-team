import { useEffect, useMemo, useState } from 'react';
import type { GameState, Tactics } from './domain/types';
import { clubOrder } from './data/initialWorld';
import { createCareer, getNextFixture, playNextRound } from './game/career';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';
import { ru } from './i18n/ru';

const tabs = ['overview', 'squad', 'tactics', 'table'] as const;
type Tab = (typeof tabs)[number];

const clubLabels: Record<string, string> = {
  northbridge: 'Northbridge FC',
  eastford: 'Eastford United',
  redharbor: 'Red Harbor',
  kingsport: 'Kingsport Athletic',
  rivergate: 'Rivergate City',
  oakvale: 'Oakvale Rovers',
  southbank: 'Southbank FC',
  lakeside: 'Lakeside Albion',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)} млн`;
  return `€${Math.round(value / 1000)} тыс.`;
}

function positionLabel(position: string): string {
  return ({ GK: ru.positions.gk, DEF: ru.positions.def, MID: ru.positions.mid, FWD: ru.positions.fwd })[position] ?? position;
}

function eventText(game: GameState, event: NonNullable<GameState['lastMatch']>['events'][number]): string {
  const team = game.clubs[event.teamId]?.name ?? ru.common.unknownClub;
  const player = event.playerId ? game.players[event.playerId]?.name : undefined;

  switch (event.type) {
    case 'goal':
      return player ? `${player} забивает за «${team}»!` : `Гол «${team}»!`;
    case 'chance':
      return `«${team}» создаёт опасный момент.`;
    case 'half-time':
      return ru.events.halfTime;
    case 'full-time':
      return ru.events.fullTime;
    case 'yellow':
      return player ? `${player} получает жёлтую карточку.` : ru.events.yellow;
    case 'injury':
      return player ? `${player} получает травму.` : ru.events.injury;
    case 'substitution':
      return ru.events.substitution;
    default:
      return event.description;
  }
}

function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [careers, setCareers] = useState<StoredCareer[]>(() => loadCareers());
  const [tab, setTab] = useState<Tab>('overview');
  const [managerName, setManagerName] = useState('');
  const [selectedClub, setSelectedClub] = useState(clubOrder[5]);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!game) return;
    saveGame(game);
    setCareers(loadCareers());
  }, [game]);

  const startCareer = () => {
    const name = managerName.trim();
    if (!name) {
      setNameError(ru.career.requiredName);
      return;
    }

    setNameError('');
    const next = createCareer(name, selectedClub);
    saveGame(next);
    setCareers(loadCareers());
    setGame(next);
    setTab('overview');
    setManagerName('');
  };

  const openCareer = (career: StoredCareer) => {
    setGame(career.state);
    setTab('overview');
  };

  const removeCareer = (careerId: string) => {
    const career = careers.find((item) => item.id === careerId);
    if (!career) return;

    const confirmed = window.confirm(`${ru.career.deleteConfirmPrefix} «${career.managerName}»?`);
    if (!confirmed) return;

    deleteCareer(careerId);
    setCareers(loadCareers());

    if (game?.careerId === careerId) setGame(null);
  };

  const leaveToCareerMenu = () => {
    if (game) saveGame(game);
    setCareers(loadCareers());
    setGame(null);
    setTab('overview');
  };

  if (!game) {
    return (
      <StartScreen
        careers={careers}
        managerName={managerName}
        selectedClub={selectedClub}
        nameError={nameError}
        setManagerName={(value) => {
          setManagerName(value);
          if (nameError) setNameError('');
        }}
        setSelectedClub={setSelectedClub}
        onStart={startCareer}
        onOpen={openCareer}
        onDelete={removeCareer}
      />
    );
  }

  const club = game.clubs[game.clubId];
  const nextFixture = getNextFixture(game);
  const tableRow = game.table.find((row) => row.teamId === game.clubId);
  const position = Math.max(1, game.table.findIndex((row) => row.teamId === game.clubId) + 1);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">DT</div>
          <div>
            <strong>Dream Team</strong>
            <span>{ru.app.subtitle}</span>
          </div>
        </div>

        <div className="topbar-meta">
          <span>{ru.app.season} {game.season}</span>
          <span>{ru.app.round} {game.currentRound}</span>
          <span>{game.managerName}</span>
          <button className="ghost-button" onClick={leaveToCareerMenu}>{ru.app.careers}</button>
        </div>
      </header>

      <main className="content">
        <section className="club-header card">
          <div>
            <div className="eyebrow">{ru.overview.yourClub}</div>
            <h1>{club.name}</h1>
            <p>{club.city} · {ru.overview.reputation} {club.reputation}</p>
          </div>
          <div className="budget-block">
            <span>{ru.overview.transferBudget}</span>
            <strong>{formatMoney(club.budget)}</strong>
          </div>
        </section>

        <nav className="tabs" aria-label={ru.app.sections}>
          {tabs.map((item) => (
            <button key={item} className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)}>
              {ru.tabs[item]}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <Overview
            game={game}
            position={position}
            row={tableRow}
            nextFixture={nextFixture}
            onPlay={() => setGame(playNextRound(game))}
          />
        )}
        {tab === 'squad' && <Squad game={game} />}
        {tab === 'tactics' && (
          <Tactics
            game={game}
            onChange={(tactic) => setGame({ ...game, clubs: { ...game.clubs, [club.id]: { ...club, tactic } } })}
          />
        )}
        {tab === 'table' && <LeagueTable game={game} />}
      </main>
    </div>
  );
}

function StartScreen(props: {
  careers: StoredCareer[];
  managerName: string;
  selectedClub: string;
  nameError: string;
  setManagerName: (value: string) => void;
  setSelectedClub: (value: string) => void;
  onStart: () => void;
  onOpen: (career: StoredCareer) => void;
  onDelete: (careerId: string) => void;
}) {
  return (
    <div className="start-screen">
      <div className="start-orb orb-one" />
      <div className="start-orb orb-two" />

      <main className="start-layout">
        <section className="start-hero">
          <div className="hero-badge">DT</div>
          <div className="eyebrow">{ru.start.eyebrow}</div>
          <h1>{ru.start.titleLineOne}<span>{ru.start.titleLineTwo}</span></h1>
          <p className="hero-copy">{ru.start.description}</p>

          <div className="hero-points">
            <span>◈ {ru.start.featureSimulation}</span>
            <span>◈ {ru.start.featureTactics}</span>
            <span>◈ {ru.start.featureHistory}</span>
          </div>
        </section>

        <section className="start-panel card">
          <div className="section-title-row">
            <div>
              <div className="eyebrow">{ru.career.newCareer}</div>
              <h2>{ru.career.beginTitle}</h2>
            </div>
            <span className="version-pill">MVP</span>
          </div>

          <div className="form-stack">
            <label>
              {ru.career.managerName} <span className="required">*</span>
              <input
                value={props.managerName}
                onChange={(event) => props.setManagerName(event.target.value)}
                placeholder={ru.career.namePlaceholder}
                maxLength={30}
                autoComplete="off"
                aria-invalid={Boolean(props.nameError)}
              />
              {props.nameError && <small className="form-error">{props.nameError}</small>}
            </label>

            <label>
              {ru.career.club}
              <select value={props.selectedClub} onChange={(event) => props.setSelectedClub(event.target.value)}>
                {clubOrder.map((id) => <option key={id} value={id}>{clubLabels[id]}</option>)}
              </select>
            </label>

            <button className="primary-button full large" onClick={props.onStart}>
              {ru.career.startButton}
            </button>
          </div>
        </section>

        <section className="saves-section">
          <div className="section-title-row saves-heading">
            <div>
              <div className="eyebrow">{ru.career.yourCareers}</div>
              <h2>{props.careers.length ? ru.career.chooseCareer : ru.career.noCareers}</h2>
            </div>
            <span className="muted">{props.careers.length}</span>
          </div>

          {props.careers.length ? (
            <div className="career-grid">
              {props.careers.map((career) => (
                <article className="career-card card" key={career.id}>
                  <div className="career-card-top">
                    <div className="career-avatar">{career.managerName.slice(0, 1).toUpperCase()}</div>
                    <button className="delete-button" aria-label={ru.career.delete} onClick={() => props.onDelete(career.id)}>×</button>
                  </div>

                  <div className="career-main">
                    <strong>{career.managerName}</strong>
                    <span>{career.clubName}</span>
                  </div>

                  <div className="career-meta">
                    <span>{ru.app.season} {career.state.season}</span>
                    <span>{formatDate(career.updatedAt)}</span>
                  </div>

                  <button className="secondary-button full" onClick={() => props.onOpen(career)}>
                    {ru.career.continueButton}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-careers card">
              <div className="empty-icon">✦</div>
              <strong>{ru.career.emptyTitle}</strong>
              <span>{ru.career.emptyDescription}</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Overview({
  game,
  position,
  row,
  nextFixture,
  onPlay,
}: {
  game: GameState;
  position: number;
  row?: GameState['table'][number];
  nextFixture?: ReturnType<typeof getNextFixture>;
  onPlay: () => void;
}) {
  const club = game.clubs[game.clubId];
  const lastMatch = game.lastMatch;
  const opponentId = nextFixture ? (nextFixture.homeTeamId === game.clubId ? nextFixture.awayTeamId : nextFixture.homeTeamId) : undefined;
  const opponent = opponentId ? game.clubs[opponentId] : undefined;
  const home = nextFixture?.homeTeamId === game.clubId;

  return (
    <div className="dashboard-grid">
      <section className="card next-match">
        <div className="section-title-row">
          <div><div className="eyebrow">{ru.overview.nextMatch}</div><h2>{nextFixture ? `${ru.overview.matchday} ${game.currentRound}` : ru.overview.seasonComplete}</h2></div>
          {nextFixture && <span className="match-tag">{home ? ru.overview.home : ru.overview.away}</span>}
        </div>

        {opponent ? (
          <>
            <div className="fixture-line">
              <div className="team-side">
                <div className="team-badge" style={{ background: club.color }}>{club.shortName}</div>
                <strong>{club.name}</strong>
              </div>
              <div className="vs">VS</div>
              <div className="team-side">
                <div className="team-badge" style={{ background: opponent.color }}>{opponent.shortName}</div>
                <strong>{opponent.name}</strong>
              </div>
            </div>
            <button className="primary-button full" onClick={onPlay}>{ru.overview.simulate}</button>
          </>
        ) : <div className="empty-state">{ru.overview.noMatch}</div>}
      </section>

      <section className="card stat-card">
        <div className="eyebrow">{ru.overview.snapshot}</div>
        <div className="stat-grid">
          <Stat label={ru.overview.position} value={`${position}`} suffix={ru.overview.placeSuffix} />
          <Stat label={ru.overview.played} value={`${row?.played ?? 0}`} />
          <Stat label={ru.overview.wins} value={`${row?.wins ?? 0}`} />
          <Stat label={ru.overview.points} value={`${row?.points ?? 0}`} />
        </div>
      </section>

      <section className="card last-match-card">
        <div className="eyebrow">{ru.overview.latestResult}</div>
        {lastMatch ? (
          <div className="latest-result">
            <div>{game.clubs[lastMatch.homeTeamId]?.shortName}</div>
            <strong>{lastMatch.homeGoals} — {lastMatch.awayGoals}</strong>
            <div>{game.clubs[lastMatch.awayTeamId]?.shortName}</div>
          </div>
        ) : <div className="empty-state">{ru.overview.firstMatch}</div>}

        {lastMatch && (
          <div className="mini-stats">
            <span>xG {lastMatch.homeXg.toFixed(2)} — {lastMatch.awayXg.toFixed(2)}</span>
            <span>{ru.overview.possession} {lastMatch.homePossession}% — {lastMatch.awayPossession}%</span>
            <span>{ru.overview.shots} {lastMatch.homeShots} — {lastMatch.awayShots}</span>
          </div>
        )}
      </section>

      <section className="card events-card">
        <div className="section-title-row"><div><div className="eyebrow">{ru.overview.events}</div><h2>{ru.overview.timeline}</h2></div></div>
        {lastMatch ? <EventTimeline game={game} /> : <div className="empty-state">{ru.overview.timelineEmpty}</div>}
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
          <span>{eventText(game, event)}</span>
        </div>
      ))}
    </div>
  );
}

function Squad({ game }: { game: GameState }) {
  const club = game.clubs[game.clubId];
  const players = club.playerIds.map((id) => game.players[id]).filter(Boolean);

  return (
    <section className="card content-card">
      <div className="section-title-row">
        <div><div className="eyebrow">{ru.squad.firstTeam}</div><h2>{ru.tabs.squad}</h2></div>
        <span className="muted">{players.length} {ru.squad.players}</span>
      </div>

      <div className="player-list">
        {players.map((player, index) => (
          <div className="player-row" key={player.id}>
            <div className="player-number">{index + 1}</div>
            <div className="player-main">
              <strong>{player.name}</strong>
              <span>{positionLabel(player.position)} · {player.preferredFoot === 'L' ? ru.squad.leftFoot : ru.squad.rightFoot}</span>
            </div>
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

function Tactics({ game, onChange }: { game: GameState; onChange: (tactic: Tactics) => void }) {
  const tactic = game.clubs[game.clubId].tactic;
  const fields: Array<[string, keyof Tactics, string[]]> = [
    [ru.tactics.formation, 'formation', ['4-3-3', '4-4-2', '4-2-3-1']],
    [ru.tactics.mentality, 'mentality', [ru.tactics.options.veryDefensive, ru.tactics.options.defensive, ru.tactics.options.balanced, ru.tactics.options.attacking, ru.tactics.options.veryAttacking]],
    [ru.tactics.tempo, 'tempo', [ru.tactics.options.slow, ru.tactics.options.normal, ru.tactics.options.fast]],
    [ru.tactics.pressing, 'pressing', [ru.tactics.options.low, ru.tactics.options.medium, ru.tactics.options.high]],
    [ru.tactics.defensiveLine, 'defensiveLine', [ru.tactics.options.low, ru.tactics.options.normal, ru.tactics.options.high]],
    [ru.tactics.width, 'width', [ru.tactics.options.narrow, ru.tactics.options.balanced, ru.tactics.options.wide]],
  ];

  return (
    <section className="card content-card">
      <div className="section-title-row">
        <div><div className="eyebrow">{ru.tactics.eyebrow}</div><h2>{ru.tabs.tactics}</h2></div>
        <span className="muted">{ru.tactics.hint}</span>
      </div>
      <div className="tactic-grid">
        {fields.map(([label, key, options]) => (
          <label key={key} className="tactic-field">
            {label}
            <select value={translateTacticToRussian(tactic[key])} onChange={(event) => onChange({ ...tactic, [key]: translateTacticFromRussian(event.target.value) })}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="tactic-explainer">
        <strong>{ru.tactics.howItWorks}</strong>
        <span>{ru.tactics.explanation}</span>
      </div>
    </section>
  );
}

function translateTacticToRussian(value: string): string {
  const map: Record<string, string> = {
    'Very Defensive': ru.tactics.options.veryDefensive,
    Defensive: ru.tactics.options.defensive,
    Balanced: ru.tactics.options.balanced,
    Attacking: ru.tactics.options.attacking,
    'Very Attacking': ru.tactics.options.veryAttacking,
    Slow: ru.tactics.options.slow,
    Normal: ru.tactics.options.normal,
    Fast: ru.tactics.options.fast,
    Low: ru.tactics.options.low,
    Medium: ru.tactics.options.medium,
    High: ru.tactics.options.high,
    Narrow: ru.tactics.options.narrow,
    Wide: ru.tactics.options.wide,
  };
  return map[value] ?? value;
}

function translateTacticFromRussian(value: string): Tactics[keyof Tactics] {
  const map: Record<string, string> = {
    [ru.tactics.options.veryDefensive]: 'Very Defensive',
    [ru.tactics.options.defensive]: 'Defensive',
    [ru.tactics.options.balanced]: 'Balanced',
    [ru.tactics.options.attacking]: 'Attacking',
    [ru.tactics.options.veryAttacking]: 'Very Attacking',
    [ru.tactics.options.slow]: 'Slow',
    [ru.tactics.options.normal]: 'Normal',
    [ru.tactics.options.fast]: 'Fast',
    [ru.tactics.options.low]: 'Low',
    [ru.tactics.options.medium]: 'Medium',
    [ru.tactics.options.high]: 'High',
    [ru.tactics.options.narrow]: 'Narrow',
    [ru.tactics.options.wide]: 'Wide',
  };
  return (map[value] ?? value) as Tactics[keyof Tactics];
}

function LeagueTable({ game }: { game: GameState }) {
  const rows = useMemo(() => [...game.table], [game.table]);

  return (
    <section className="card content-card">
      <div className="section-title-row">
        <div><div className="eyebrow">{ru.table.eyebrow}</div><h2>{ru.tabs.table}</h2></div>
        <span className="muted">{ru.app.season} {game.season}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>{ru.table.club}</th><th>{ru.table.played}</th><th>{ru.table.wins}</th><th>{ru.table.draws}</th><th>{ru.table.losses}</th><th>ЗГ</th><th>ПГ</th><th>РЗ</th><th>{ru.table.points}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowClub = game.clubs[row.teamId];
              return (
                <tr className={row.teamId === game.clubId ? 'your-club' : ''} key={row.teamId}>
                  <td>{index + 1}</td>
                  <td><strong>{rowClub.name}</strong></td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
                  <td>{row.goalsFor}</td>
                  <td>{row.goalsAgainst}</td>
                  <td>{row.goalsFor - row.goalsAgainst}</td>
                  <td><strong>{row.points}</strong></td>
                </tr>
              );
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

export default App;
