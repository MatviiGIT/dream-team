import { useEffect, useMemo, useState } from 'react';
import type { GameState, MatchPlayerStats, MatchResult, Player, Position, Tactics } from './domain/types';
import { clubOrder } from './data/initialWorld';
import { createCareer, getNextFixture, playNextRound } from './game/career';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';
import { ru } from './i18n/ru';

const tabs = ['overview', 'squad', 'tactics', 'table'] as const;
type Tab = (typeof tabs)[number];
type Theme = 'aurora' | 'midnight' | 'light';

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

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // The browser can deny fullscreen; keep the button harmless.
    }
  };

  return (
    <button className="ghost-button fullscreen-button" onClick={toggle} aria-pressed={isFullscreen}>
      <span aria-hidden="true">⛶</span>
      {isFullscreen ? ru.app.exitFullscreen : ru.app.fullscreen}
    </button>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  const assist = event.assistPlayerId ? game.players[event.assistPlayerId]?.name : undefined;

  switch (event.type) {
    case 'goal':
      if (!player) return `Гол «${team}»!`;
      return assist
        ? `${player} забивает за «${team}» (пас: ${assist}).`
        : `${player} забивает за «${team}»!`;
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
  const [matchCenter, setMatchCenter] = useState<{ match: MatchResult; season: number; round: number } | null>(null);
  const [managerName, setManagerName] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>(clubOrder[5]);
  const [nameError, setNameError] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dream-team:theme');
    return saved === 'midnight' || saved === 'light' ? saved : 'aurora';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dream-team:theme', theme);
  }, [theme]);

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
    setMatchCenter(null);
    setManagerName('');
  };

  const openCareer = (career: StoredCareer) => {
    setGame(career.state);
    setTab('overview');
    setMatchCenter(null);
  };

  const removeCareer = (careerId: string) => {
    const career = careers.find((item) => item.id === careerId);
    if (!career) return;

    deleteCareer(careerId);
    setCareers(loadCareers());

    if (game?.careerId === careerId) setGame(null);
  };

  const leaveToCareerMenu = () => {
    if (game) saveGame(game);
    setCareers(loadCareers());
    setGame(null);
    setMatchCenter(null);
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
        theme={theme}
        onThemeChange={setTheme}
      />
    );
  }

  const club = game.clubs[game.clubId];
  const nextFixture = getNextFixture(game);
  const tableRow = game.table.find((row) => row.teamId === game.clubId);
  const position = Math.max(1, game.table.findIndex((row) => row.teamId === game.clubId) + 1);

  return (
    <div className={`app-shell app-shell-${tab}`}>
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
          <FullscreenButton />
          <button className="ghost-button" onClick={leaveToCareerMenu}>{ru.app.careers}</button>
        </div>
      </header>

      <main className={`content content-${tab}`}>
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
            onPlay={() => {
              const matchSeason = game.season;
              const matchRound = game.currentRound;
              const nextGame = playNextRound(game);
              setGame(nextGame);
              if (nextGame.lastMatch) {
                setMatchCenter({ match: nextGame.lastMatch, season: matchSeason, round: matchRound });
              }
            }}
          />
        )}
        {tab === 'squad' && (
          <Squad
            game={game}
            onChange={(nextGame) => setGame(nextGame)}
          />
        )}
        {tab === 'tactics' && (
          <Tactics
            game={game}
            onChange={(tactic) => setGame({ ...game, clubs: { ...game.clubs, [club.id]: { ...club, tactic } } })}
          />
        )}
        {tab === 'table' && <LeagueTable game={game} />}
      </main>
      {matchCenter && (
        <MatchCenter
          game={game}
          match={matchCenter.match}
          season={matchCenter.season}
          round={matchCenter.round}
          onClose={() => setMatchCenter(null)}
        />
      )}
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
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoredCareer | null>(null);
  const START_WIDTH = 1440;
  const START_HEIGHT = 900;
  const readViewport = () => ({
    width: Math.max(1, window.visualViewport?.width ?? window.innerWidth),
    height: Math.max(1, window.visualViewport?.height ?? window.innerHeight),
  });
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const syncViewport = () => setViewport(readViewport());
    window.addEventListener('resize', syncViewport);
    document.addEventListener('fullscreenchange', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      document.removeEventListener('fullscreenchange', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, []);

  const scale = Math.min(viewport.width / START_WIDTH, viewport.height / START_HEIGHT);

  return (
    <div className="start-screen">
      <div className="start-stage-frame">
        <div
          className="start-stage"
          style={{
            transform: `scale(${scale})`,
          }}
        >
          <div className="start-toolbar">
            <button className="ghost-button settings-button" type="button" onClick={() => setSettingsOpen(true)}>
              <span aria-hidden="true">⚙</span>
              {ru.settings.openButton}
            </button>
            <FullscreenButton />
          </div>

          <main className="start-layout">
            <section className="start-hero">
              <div className="eyebrow">{ru.start.eyebrow}</div>
              <h1>{ru.start.titleLineOne}<span>{ru.start.titleLineTwo}</span></h1>
              <div className="latest-update">
                <div className="latest-update-header">
                  <span className="eyebrow">{ru.start.latestUpdate}</span>
                  <span className="update-badge">NEW</span>
                </div>
                <h2>{ru.start.updateTitle}</h2>
                <p>{ru.start.updateDescription}</p>
                <div className="update-list">
                  <span>✦ {ru.start.updateItemOne}</span>
                  <span>✦ {ru.start.updateItemTwo}</span>
                  <span>✦ {ru.start.updateItemThree}</span>
                </div>
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
                  <h2>{props.careers.length ? ru.career.chooseCareer : ru.career.emptySectionTitle}</h2>
                </div>
              </div>

              {props.careers.length ? (
                <div className="career-grid">
                  {props.careers.map((career, index) => (
                    <article className="career-card card" key={career.id}>
                      <div className="career-card-top">
                        <div className="career-avatar">{career.managerName.slice(0, 1).toUpperCase()}</div>
                        <button
                          className="delete-button"
                          aria-label={ru.career.delete}
                          onClick={() => setDeleteTarget(career)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="career-index">{ru.career.saveNumber} №{index + 1}</div>

                      <div className="career-main">
                        <strong>{career.managerName}</strong>
                        <span>{career.clubName}</span>
                      </div>

                      <div className="career-meta">
                        <span>{ru.app.season} {career.state.season}</span>
                        <span title={formatDateTime(career.createdAt)}>{ru.career.addedAt} {formatDateTime(career.createdAt)}</span>
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

          {deleteTarget && (
        <div
          className="modal-backdrop confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}
        >
          <section className="modal-window confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-career-title">
            <div className="modal-header">
              <div>
                <div className="eyebrow">{ru.career.deleteEyebrow}</div>
                <h2 id="delete-career-title">{ru.career.deleteTitle}</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setDeleteTarget(null)} aria-label={ru.common.close}>×</button>
            </div>
            <p className="confirm-copy">
              {ru.career.deleteDescriptionPrefix} «{deleteTarget.managerName}»?
            </p>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>
                {ru.career.cancel}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  props.onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                {ru.career.delete}
              </button>
            </div>
          </section>
        </div>
      )}
      {settingsOpen && (
            <SettingsModal
              theme={props.theme}
              onThemeChange={props.onThemeChange}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function SettingsModal({
  theme,
  onThemeChange,
  onClose,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-window settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">{ru.settings.eyebrow}</div>
            <h2 id="settings-title">{ru.settings.title}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label={ru.common.close}>×</button>
        </div>

        <div className="settings-modal-body">
          <div className="settings-modal-group">
            <span className="settings-label">{ru.settings.language}</span>
            <div className="settings-options language-options">
              <button className="setting-option active" type="button">
                <strong>{ru.settings.russian}</strong>
                <span>{ru.settings.available}</span>
              </button>
              <button className="setting-option disabled" type="button" disabled>
                <strong>{ru.settings.english}</strong>
                <span>{ru.settings.comingSoon}</span>
              </button>
              <button className="setting-option disabled" type="button" disabled>
                <strong>{ru.settings.german}</strong>
                <span>{ru.settings.comingSoon}</span>
              </button>
            </div>
          </div>

          <div className="settings-modal-group">
            <span className="settings-label">{ru.settings.theme}</span>
            <div className="settings-options theme-options">
              {([
                ['aurora', ru.settings.aurora],
                ['midnight', ru.settings.midnight],
                ['light', ru.settings.light],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={theme === value ? 'setting-option theme-option active' : 'setting-option theme-option'}
                  onClick={() => onThemeChange(value)}
                >
                  <span className={`theme-swatch theme-${value}`} />
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-footnote">{ru.settings.note}</div>
        </div>
      </section>
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

      <UpcomingCalendar game={game} />

      <section className="card manager-card">
        <div className="section-title-row">
          <div><div className="eyebrow">{ru.overview.managerPanel}</div><h2>{ru.overview.managerTitle}</h2></div>
          <span className="future-tag">{ru.overview.futureTag}</span>
        </div>
        <div className="manager-profile">
          <div className="manager-avatar">{game.managerName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{game.managerName}</strong>
            <span>{ru.overview.managerRole}</span>
          </div>
        </div>
        <div className="manager-stats">
          <div><span>{ru.overview.managerReputation}</span><strong>—</strong></div>
          <div><span>{ru.overview.seasons}</span><strong>{Math.max(0, game.season - 1)}</strong></div>
        </div>
      </section>
    </div>
  );
}

function UpcomingCalendar({ game }: { game: GameState }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const fixtures = game.fixtures
    .filter((fixture) => fixture.round <= 14 && !fixture.played && (fixture.homeTeamId === game.clubId || fixture.awayTeamId === game.clubId))
    .sort((a, b) => a.round - b.round);

  const preview = fixtures.slice(0, 2);

  return (
    <>
      <button className="card calendar-card calendar-preview" onClick={() => setCalendarOpen(true)}>
        <div className="section-title-row">
          <div>
            <div className="eyebrow">{ru.overview.calendarPanel}</div>
            <h2>{ru.overview.calendarTitle}</h2>
          </div>
          <span className="future-tag">{ru.overview.openButton}</span>
        </div>

        <div className="calendar-preview-list">
          {preview.map((fixture) => {
            const home = fixture.homeTeamId === game.clubId;
            const opponentId = home ? fixture.awayTeamId : fixture.homeTeamId;
            const opponent = game.clubs[opponentId];

            return (
              <div className="calendar-row compact" key={fixture.id}>
                <span className="calendar-round">{fixture.round}</span>
                <span className="calendar-venue">{home ? ru.overview.homeShort : ru.overview.awayShort}</span>
                <span className="calendar-opponent">{opponent?.name ?? ru.common.unknownClub}</span>
                <span className="calendar-badge" style={{ background: opponent?.color ?? '#50616d' }}>
                  {opponent?.shortName ?? '—'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="calendar-footer">
          <span>{fixtures.length ? ru.overview.calendarCount(fixtures.length) : ru.overview.calendarEmpty}</span>
          <span>→</span>
        </div>
      </button>

      {calendarOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCalendarOpen(false);
        }}>
          <section className="modal-window" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
            <div className="modal-header">
              <div>
                <div className="eyebrow">{ru.overview.calendarPanel}</div>
                <h2 id="calendar-title">{ru.overview.calendarTitle}</h2>
              </div>
              <button className="modal-close" onClick={() => setCalendarOpen(false)} aria-label={ru.common.close}>×</button>
            </div>

            <div className="full-calendar-list">
              {fixtures.map((fixture) => {
                const isHome = fixture.homeTeamId === game.clubId;
                const opponentId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
                const opponent = game.clubs[opponentId];

                return (
                  <div className="full-calendar-row" key={fixture.id}>
                    <div className="full-calendar-round">
                      <span>{ru.overview.matchday}</span>
                      <strong>{fixture.round}</strong>
                    </div>
                    <div className="full-calendar-main">
                      <strong>{opponent?.name ?? ru.common.unknownClub}</strong>
                      <span>{isHome ? ru.overview.home : ru.overview.away}</span>
                    </div>
                    <div className="full-calendar-badge" style={{ background: opponent?.color ?? '#50616d' }}>
                      {opponent?.shortName ?? '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            {!fixtures.length && <div className="modal-empty">{ru.overview.calendarEmpty}</div>}
            <button className="secondary-button full modal-action" onClick={() => setCalendarOpen(false)}>
              {ru.common.close}
            </button>
          </section>
        </div>
      )}
    </>
  );
}


function getMatchPlayerStats(
  game: GameState,
  match: MatchResult,
  teamId: string,
): MatchPlayerStats[] {
  const club = game.clubs[teamId];
  const ids = club?.startingXI?.length === 11 ? club.startingXI : club?.playerIds.slice(0, 11) ?? [];

  return ids
    .map((playerId) => match.playerStats?.[playerId])
    .filter((stats): stats is MatchPlayerStats => Boolean(stats));
}

type MatchDetailPanel = 'timeline' | 'stats' | 'ratings';

function MatchCenter({
  game,
  match,
  season,
  round,
  onClose,
}: {
  game: GameState;
  match: MatchResult;
  season: number;
  round: number;
  onClose: () => void;
}) {
  const [detailPanel, setDetailPanel] = useState<MatchDetailPanel | null>(null);
  const home = game.clubs[match.homeTeamId];
  const away = game.clubs[match.awayTeamId];
  const userGoals = match.homeTeamId === game.clubId ? match.homeGoals : match.awayGoals;
  const opponentGoals = match.homeTeamId === game.clubId ? match.awayGoals : match.homeGoals;
  const outcome = userGoals > opponentGoals ? 'win' : userGoals === opponentGoals ? 'draw' : 'loss';
  const goalEvents = match.events.filter((event) => event.type === 'goal');
  const homeGoals = goalEvents.filter((event) => event.teamId === match.homeTeamId);
  const awayGoals = goalEvents.filter((event) => event.teamId === match.awayTeamId);
  const homePlayerStats = getMatchPlayerStats(game, match, match.homeTeamId)
    .sort((a, b) => b.rating - a.rating);
  const awayPlayerStats = getMatchPlayerStats(game, match, match.awayTeamId)
    .sort((a, b) => b.rating - a.rating);

  const scorerText = (event: MatchResult['events'][number]) => {
    const player = event.playerId ? game.players[event.playerId]?.name : undefined;
    return player ? `${player} ${event.minute}'` : `${event.minute}'`;
  };

  const ratingRow = (stats: MatchPlayerStats, index: number) => {
    const player = game.players[stats.playerId];
    if (!player) return null;

    return (
      <div className="match-player-rating-row" key={stats.playerId}>
        <span className="match-player-rating-number">{index + 1}</span>
        <div className="match-player-rating-main">
          <strong>{player.name}</strong>
          <span>{positionLabel(player.position)} · {stats.minutes}'</span>
        </div>
        <strong className="match-player-rating-score">{stats.rating.toFixed(1)}</strong>
        <span className="match-player-rating-stat"><small>{ru.matchCenter.goals}</small><strong>{stats.goals}</strong></span>
        <span className="match-player-rating-stat"><small>{ru.matchCenter.assists}</small><strong>{stats.assists}</strong></span>
        <span className="match-player-rating-stat"><small>{ru.matchCenter.shotsShort}</small><strong>{stats.shots}</strong></span>
      </div>
    );
  };

  const renderDetail = () => {
    if (detailPanel === 'timeline') {
      return (
        <section className="match-detail-modal" role="dialog" aria-modal="true" aria-labelledby="match-detail-title">
          <div className="match-detail-header">
            <div>
              <div className="eyebrow">{ru.matchCenter.eventsLabel}</div>
              <h3 id="match-detail-title">{ru.matchCenter.timeline}</h3>
            </div>
            <button className="modal-close" type="button" onClick={() => setDetailPanel(null)} aria-label={ru.common.close}>×</button>
          </div>
          <div className="match-detail-timeline">
            {match.events.map((event) => (
              <div className="match-center-event" key={event.id}>
                <span className="minute">{event.minute}'</span>
                <span className={`event-dot ${event.type}`}></span>
                <span>{eventText(game, event)}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (detailPanel === 'stats') {
      return (
        <section className="match-detail-modal match-detail-stats-modal" role="dialog" aria-modal="true" aria-labelledby="match-detail-title">
          <div className="match-detail-header">
            <div>
              <div className="eyebrow">{ru.matchCenter.stats}</div>
              <h3 id="match-detail-title">{ru.matchCenter.statsTitle}</h3>
            </div>
            <button className="modal-close" type="button" onClick={() => setDetailPanel(null)} aria-label={ru.common.close}>×</button>
          </div>

          <div className="match-stat-list">
            <div>
              <span>{ru.matchCenter.xg}</span>
              <strong>{match.homeXg.toFixed(2)} — {match.awayXg.toFixed(2)}</strong>
            </div>
            <div>
              <span>{ru.matchCenter.possession}</span>
              <strong>{match.homePossession}% — {match.awayPossession}%</strong>
            </div>
            <div>
              <span>{ru.matchCenter.shots}</span>
              <strong>{match.homeShots} — {match.awayShots}</strong>
            </div>
          </div>

          <div className="match-detail-teams">
            <div>
              <span>{ru.matchCenter.home}</span>
              <strong>{home?.name ?? ru.common.unknownClub}</strong>
            </div>
            <div>
              <span>{ru.matchCenter.away}</span>
              <strong>{away?.name ?? ru.common.unknownClub}</strong>
            </div>
          </div>
        </section>
      );
    }

    if (detailPanel === 'ratings') {
      return (
        <section className="match-detail-modal match-detail-ratings-modal" role="dialog" aria-modal="true" aria-labelledby="match-detail-title">
          <div className="match-detail-header">
            <div>
              <div className="eyebrow">{ru.matchCenter.playerRatings}</div>
              <h3 id="match-detail-title">{ru.matchCenter.playerRatingsTitle}</h3>
            </div>
            <div className="match-detail-header-meta">
              <span>{ru.matchCenter.playerRatingsHint}</span>
              <span>{ru.matchCenter.bestFirst}</span>
              <button className="modal-close" type="button" onClick={() => setDetailPanel(null)} aria-label={ru.common.close}>×</button>
            </div>
          </div>

          {match.playerStats ? (
            <div className="match-player-rating-columns">
              <div className="match-player-rating-team home">
                <div className="match-player-rating-team-header">
                  <strong>{home?.shortName ?? '—'}</strong>
                  <span>{ru.matchCenter.rating} · {ru.matchCenter.goals} · {ru.matchCenter.assists} · {ru.matchCenter.shotsShort}</span>
                </div>
                <div className="match-player-rating-list">
                  {homePlayerStats.map(ratingRow)}
                </div>
              </div>
              <div className="match-player-rating-team away">
                <div className="match-player-rating-team-header">
                  <strong>{away?.shortName ?? '—'}</strong>
                  <span>{ru.matchCenter.rating} · {ru.matchCenter.goals} · {ru.matchCenter.assists} · {ru.matchCenter.shotsShort}</span>
                </div>
                <div className="match-player-rating-list">
                  {awayPlayerStats.map(ratingRow)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">{ru.matchCenter.playerRatingsEmpty}</div>
          )}
        </section>
      );
    }

    return null;
  };

  return (
    <div className="modal-backdrop match-center-backdrop" role="presentation">
      <section className="match-center-modal" role="dialog" aria-modal="true" aria-labelledby="match-center-title">
        <div className="match-center-header">
          <div>
            <div className="eyebrow">{ru.matchCenter.eyebrow}</div>
            <h2 id="match-center-title">{ru.matchCenter.title}</h2>
          </div>
          <div className="match-center-header-meta">
            <span>{ru.app.season} {season}</span>
            <span>{ru.matchCenter.round} {round}</span>
            <button className="modal-close" type="button" onClick={onClose} aria-label={ru.common.close}>×</button>
          </div>
        </div>

        <div className="match-center-scoreboard">
          <div className="match-center-team home">
            <div className="match-center-badge" style={{ background: home?.color ?? '#50616d' }}>
              {home?.shortName ?? '—'}
            </div>
            <strong>{home?.name ?? ru.common.unknownClub}</strong>
            <span>{ru.matchCenter.home}</span>
            <div className="match-center-scorers">
              {homeGoals.length
                ? homeGoals.map((event) => <span key={event.id}>{scorerText(event)}</span>)
                : <span>{ru.matchCenter.noGoals}</span>}
            </div>
          </div>

          <div className="match-center-score-block">
            <span className={`match-center-result ${outcome}`}>{ru.matchCenter[outcome]}</span>
            <strong>{match.homeGoals} — {match.awayGoals}</strong>
            <span>{ru.matchCenter.finalScore}</span>
          </div>

          <div className="match-center-team away">
            <div className="match-center-badge" style={{ background: away?.color ?? '#50616d' }}>
              {away?.shortName ?? '—'}
            </div>
            <strong>{away?.name ?? ru.common.unknownClub}</strong>
            <span>{ru.matchCenter.away}</span>
            <div className="match-center-scorers">
              {awayGoals.length
                ? awayGoals.map((event) => <span key={event.id}>{scorerText(event)}</span>)
                : <span>{ru.matchCenter.noGoals}</span>}
            </div>
          </div>
        </div>

        <div className="match-center-menu-grid">
          <button className="match-center-menu-card timeline" type="button" onClick={() => setDetailPanel('timeline')}>
            <span className="match-center-menu-icon">◷</span>
            <div>
              <div className="eyebrow">{ru.matchCenter.eventsLabel}</div>
              <strong>{ru.matchCenter.timeline}</strong>
              <span>{ru.matchCenter.eventCount(match.events.length)}</span>
            </div>
            <span className="match-center-menu-arrow">→</span>
          </button>

          <button className="match-center-menu-card stats" type="button" onClick={() => setDetailPanel('stats')}>
            <span className="match-center-menu-icon">↗</span>
            <div>
              <div className="eyebrow">{ru.matchCenter.stats}</div>
              <strong>{ru.matchCenter.statsTitle}</strong>
              <span>{ru.matchCenter.statsPreview(match.homePossession, match.awayPossession)}</span>
            </div>
            <span className="match-center-menu-arrow">→</span>
          </button>

          <button className="match-center-menu-card ratings" type="button" onClick={() => setDetailPanel('ratings')}>
            <span className="match-center-menu-icon">★</span>
            <div>
              <div className="eyebrow">{ru.matchCenter.playerRatings}</div>
              <strong>{ru.matchCenter.playerRatingsTitle}</strong>
              <span>{ru.matchCenter.playerRatingsPreview}</span>
            </div>
            <span className="match-center-menu-arrow">→</span>
          </button>
        </div>

        <button className="primary-button full match-center-action" type="button" onClick={onClose}>
          {ru.matchCenter.continueButton}
        </button>
      </section>

      {detailPanel && (
        <div
          className="match-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailPanel(null);
          }}
        >
          {renderDetail()}
        </div>
      )}
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

type SquadPitchRole = 'keeper' | 'defender' | 'midfielder' | 'attacker';

type SquadSlot = {
  left: number;
  top: number;
  role: SquadPitchRole;
  label: string;
};

const squadFormationSlots: Record<Tactics['formation'], SquadSlot[]> = {
  '4-3-3': [
    { left: 50, top: 89, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 71, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 71, role: 'defender', label: 'ПЗ' },
    { left: 50, top: 53, role: 'midfielder', label: 'ОП' },
    { left: 31, top: 43, role: 'midfielder', label: 'ЦП' },
    { left: 69, top: 43, role: 'midfielder', label: 'ЦП' },
    { left: 15, top: 21, role: 'attacker', label: 'ЛФ' },
    { left: 50, top: 15, role: 'attacker', label: 'ЦН' },
    { left: 85, top: 21, role: 'attacker', label: 'ПФ' },
  ],
  '4-4-2': [
    { left: 50, top: 89, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 71, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 71, role: 'defender', label: 'ПЗ' },
    { left: 15, top: 48, role: 'midfielder', label: 'ЛП' },
    { left: 38, top: 48, role: 'midfielder', label: 'ЦП' },
    { left: 62, top: 48, role: 'midfielder', label: 'ЦП' },
    { left: 85, top: 48, role: 'midfielder', label: 'ПП' },
    { left: 38, top: 18, role: 'attacker', label: 'ЦН' },
    { left: 62, top: 18, role: 'attacker', label: 'ЦН' },
  ],
  '4-2-3-1': [
    { left: 50, top: 89, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 71, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 71, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 71, role: 'defender', label: 'ПЗ' },
    { left: 37, top: 53, role: 'midfielder', label: 'ОП' },
    { left: 63, top: 53, role: 'midfielder', label: 'ОП' },
    { left: 17, top: 34, role: 'attacker', label: 'ЛФ' },
    { left: 50, top: 31, role: 'attacker', label: 'АП' },
    { left: 83, top: 34, role: 'attacker', label: 'ПФ' },
    { left: 50, top: 14, role: 'attacker', label: 'ЦН' },
  ],
};

function expectedPositionForRole(role: SquadPitchRole): Position {
  switch (role) {
    case 'keeper': return 'GK';
    case 'defender': return 'DEF';
    case 'midfielder': return 'MID';
    case 'attacker': return 'FWD';
  }
}

function replacementFit(player: Player, slot: SquadSlot): 'good' | 'adaptable' | 'poor' {
  const expected = expectedPositionForRole(slot.role);
  if (player.position === expected) return 'good';

  const adaptable =
    (player.position === 'DEF' && expected === 'MID') ||
    (player.position === 'MID' && expected === 'DEF') ||
    (player.position === 'MID' && expected === 'FWD') ||
    (player.position === 'FWD' && expected === 'MID');

  return adaptable ? 'adaptable' : 'poor';
}

function Squad({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const club = game.clubs[game.clubId];
  const roster = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  const initialXI = club.startingXI?.length === 11 ? club.startingXI : club.playerIds.slice(0, 11);
  const [lineupIds, setLineupIds] = useState<string[]>(initialXI);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    const next = club.startingXI?.length === 11 ? club.startingXI : club.playerIds.slice(0, 11);
    setLineupIds(next);
    setSelectedSlot(null);
  }, [game.clubId, club.startingXI, club.playerIds]);

  const slots = squadFormationSlots[club.tactic.formation];
  const substitutes = roster.filter((player) => !lineupIds.includes(player.id));
  const selectedPlayer = selectedSlot === null ? undefined : game.players[lineupIds[selectedSlot]];
  const selectedSlotData = selectedSlot === null ? undefined : slots[selectedSlot];

  const commitLineup = (nextLineup: string[]) => {
    setLineupIds(nextLineup);
    onChange({
      ...game,
      clubs: {
        ...game.clubs,
        [club.id]: {
          ...club,
          startingXI: nextLineup,
        },
      },
    });
  };

  const swapSlots = (first: number, second: number) => {
    if (first === second) {
      setSelectedSlot(null);
      return;
    }
    const next = [...lineupIds];
    [next[first], next[second]] = [next[second], next[first]];
    commitLineup(next);
    setSelectedSlot(null);
  };

  const handleRosterClick = (playerId: string) => {
    if (selectedSlot === null) return;

    const rosterIndex = lineupIds.indexOf(playerId);
    if (rosterIndex >= 0) {
      swapSlots(selectedSlot, rosterIndex);
      return;
    }

    const next = [...lineupIds];
    next[selectedSlot] = playerId;
    commitLineup(next);
    setSelectedSlot(null);
  };

  const fitLabel = (fit: ReturnType<typeof replacementFit>) => {
    if (fit === 'good') return ru.squad.fitGood;
    if (fit === 'adaptable') return ru.squad.fitAdaptable;
    return ru.squad.fitPoor;
  };

  return (
    <section className="card content-card squad-panel">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">{ru.squad.teamSheet}</div>
          <h2>{ru.tabs.squad}</h2>
        </div>
        <div className="squad-formation-pill">
          <span>{ru.squad.formation}</span>
          <strong>{club.tactic.formation}</strong>
        </div>
      </div>

      <div className="team-sheet">
        <div className="squad-pitch-wrap">
          <div className="squad-pitch">
            <span className="pitch-half-line" aria-hidden="true" />
            <span className="pitch-center-circle" aria-hidden="true" />
            <span className="pitch-box pitch-penalty-top" aria-hidden="true" />
            <span className="pitch-box pitch-six-top" aria-hidden="true" />
            <span className="pitch-goal pitch-goal-top" aria-hidden="true" />
            <span className="pitch-box pitch-penalty-bottom" aria-hidden="true" />
            <span className="pitch-box pitch-six-bottom" aria-hidden="true" />
            <span className="pitch-goal pitch-goal-bottom" aria-hidden="true" />

            {slots.map((slot, index) => {
              const player = game.players[lineupIds[index]];
              if (!player) return null;
              const selected = selectedSlot === index;
              const target = selectedSlot !== null && !selected;
              const markerClass = [
                'squad-player-marker',
                selected ? 'selected' : '',
                target ? 'swap-target' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={slot.label + '-' + index + '-' + player.id}
                  type="button"
                  className={markerClass}
                  style={{ left: slot.left + '%', top: slot.top + '%' }}
                  onClick={() => {
                    if (selectedSlot !== null && selectedSlot !== index) {
                      swapSlots(selectedSlot, index);
                    } else {
                      setSelectedSlot(selected ? null : index);
                    }
                  }}
                  title={player.name + ' · ' + slot.label}
                >
                  <span className="squad-player-rating">{player.overall}</span>
                  <strong>{player.name.split(' ')[0]}</strong>
                  <small>{slot.label}</small>
                </button>
              );
            })}
          </div>

          <div className="squad-pitch-note">
            {selectedSlot === null ? (
              ru.squad.selectPlayer
            ) : (
              <>
                <strong>{ru.squad.selectedLabel}:</strong> {selectedPlayer?.name} → {selectedSlotData?.label}
                <span>{ru.squad.substitutionHint}</span>
              </>
            )}
          </div>
        </div>

        <aside className={selectedSlot === null ? 'squad-roster' : 'squad-roster has-selection'}>
          <div className="squad-roster-header">
            <div>
              <div className="eyebrow">{ru.squad.benchTitle}</div>
              <strong>{ru.squad.substitutes} · {substitutes.length}</strong>
            </div>
            <span>{ru.squad.benchHint}</span>
          </div>

          {selectedPlayer && selectedSlotData && (
            <div className="squad-selection-card">
              <div>
                <span className="eyebrow">{ru.squad.replacing}</span>
                <strong>{selectedPlayer.name}</strong>
                <small>{positionLabel(selectedPlayer.position)} · {ru.squad.toPosition} {selectedSlotData.label}</small>
              </div>
              <button type="button" className="secondary-button" onClick={() => setSelectedSlot(null)}>
                {ru.squad.cancelSelection}
              </button>
            </div>
          )}

          <div className="squad-roster-list">
            {substitutes.map((player) => {
              const fit = selectedSlotData ? replacementFit(player, selectedSlotData) : null;
              const fitClass = fit ? fit : 'idle';
              const fitText = fit ? fitLabel(fit) : ru.squad.selectFirst;

              return (
                <button
                  key={player.id}
                  type="button"
                  className={'squad-roster-card reserve ' + fitClass}
                  onClick={() => handleRosterClick(player.id)}
                  disabled={selectedSlot === null}
                >
                  <span className="squad-roster-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                  <span className="squad-roster-main">
                    <strong>{player.name}</strong>
                    <small>{positionLabel(player.position)} · {player.preferredFoot === 'L' ? ru.squad.leftFoot : ru.squad.rightFoot}</small>
                  </span>
                  <span className="squad-roster-stat">
                    <small>OVR</small>
                    <strong>{player.overall}</strong>
                  </span>
                  <span className={'squad-roster-stat squad-fitness squad-fitness-' + (player.fitness >= 75 ? 'high' : player.fitness >= 50 ? 'medium' : 'low')}>
                    <small>{ru.squad.fitness}</small>
                    <strong>{player.fitness}</strong>
                  </span>
                  <span className={'squad-roster-fit ' + fitClass}>{fitText}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

type TacticSettingKey = Exclude<keyof Tactics, 'formation'>;

type TacticOption = {
  value: string;
  label: string;
};

function Tactics({ game, onChange }: { game: GameState; onChange: (tactic: Tactics) => void }) {
  const tactic = game.clubs[game.clubId].tactic;
  const [openField, setOpenField] = useState<TacticSettingKey | null>(null);

  const formations: Tactics['formation'][] = ['4-3-3', '4-4-2', '4-2-3-1'];
  const fields: Array<{
    label: string;
    key: TacticSettingKey;
    options: TacticOption[];
  }> = [
    {
      label: ru.tactics.mentality,
      key: 'mentality',
      options: [
        { value: 'Very Defensive', label: ru.tactics.options.veryDefensive },
        { value: 'Defensive', label: ru.tactics.options.defensive },
        { value: 'Balanced', label: ru.tactics.options.balanced },
        { value: 'Attacking', label: ru.tactics.options.attacking },
        { value: 'Very Attacking', label: ru.tactics.options.veryAttacking },
      ],
    },
    {
      label: ru.tactics.tempo,
      key: 'tempo',
      options: [
        { value: 'Slow', label: ru.tactics.options.slow },
        { value: 'Normal', label: ru.tactics.options.normal },
        { value: 'Fast', label: ru.tactics.options.fast },
      ],
    },
    {
      label: ru.tactics.pressing,
      key: 'pressing',
      options: [
        { value: 'Low', label: ru.tactics.options.low },
        { value: 'Medium', label: ru.tactics.options.medium },
        { value: 'High', label: ru.tactics.options.high },
      ],
    },
    {
      label: ru.tactics.defensiveLine,
      key: 'defensiveLine',
      options: [
        { value: 'Low', label: ru.tactics.options.low },
        { value: 'Normal', label: ru.tactics.options.normal },
        { value: 'High', label: ru.tactics.options.high },
      ],
    },
    {
      label: ru.tactics.width,
      key: 'width',
      options: [
        { value: 'Narrow', label: ru.tactics.options.narrow },
        { value: 'Balanced', label: ru.tactics.options.balanced },
        { value: 'Wide', label: ru.tactics.options.wide },
      ],
    },
  ];

  const updateField = (key: TacticSettingKey, value: string) => {
    onChange({ ...tactic, [key]: value } as Tactics);
    setOpenField(null);
  };

  return (
    <section className="card content-card tactics-panel">
      <div className="section-title-row">
        <div><div className="eyebrow">{ru.tactics.eyebrow}</div><h2>{ru.tabs.tactics}</h2></div>
        <span className="muted">{ru.tactics.hint}</span>
      </div>

      <div className="formation-block compact-formation-selector">
        <div className="formation-heading">
          <div>
            <span>{ru.tactics.formation}</span>
            <small>{ru.tactics.formationHint}</small>
          </div>
          <strong>{tactic.formation}</strong>
        </div>

        <div className="formation-selector-buttons">
          {formations.map((formation) => (
            <button
              key={formation}
              type="button"
              className={tactic.formation === formation ? 'formation-select-button active' : 'formation-select-button'}
              onClick={() => onChange({ ...tactic, formation })}
            >
              {formation}
            </button>
          ))}
        </div>
      </div>

      <div className="tactic-grid">
        {fields.map((field) => (
          <TacticChoice
            key={field.key}
            label={field.label}
            value={tactic[field.key]}
            options={field.options}
            open={openField === field.key}
            onToggle={() => setOpenField(openField === field.key ? null : field.key)}
            onChange={(value) => updateField(field.key, value)}
          />
        ))}
      </div>

      <div className="tactic-explainer">
        <strong>{ru.tactics.howItWorks}</strong>
        <span>{ru.tactics.explanation}</span>
      </div>
    </section>
  );
}

function TacticChoice({
  label,
  value,
  options,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  options: TacticOption[];
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <div className={open ? 'tactic-field open' : 'tactic-field'}>
      <span>{label}</span>
      <button
        className={open ? 'tactic-choice open' : 'tactic-choice'}
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        <strong>{selected?.label ?? value}</strong>
        <span className="tactic-choice-arrow" aria-hidden="true" />
      </button>

      {open && (
        <div className="tactic-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              className={option.value === value ? 'tactic-option active' : 'tactic-option'}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => onChange(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <strong aria-hidden="true">✓</strong>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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