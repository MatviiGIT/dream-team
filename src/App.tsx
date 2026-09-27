import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClubFinance, GameState, MatchResult, Player, Position, Tactics } from './domain/types';
import { clubOrder } from './data/initialWorld';
import { createCareer, getNextFixture, playNextRound } from './game/career';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';
import { ru } from './i18n/ru';
import { TransferMarket } from './components/TransferMarket';

const tabs = ['squad', 'transfers', 'tactics', 'table', 'finances'] as const;
type Tab = 'overview' | (typeof tabs)[number];
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

function FullscreenButton({ compact = false }: { compact?: boolean }) {
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
    <button
      className={compact ? 'ghost-button fullscreen-button fullscreen-button-compact' : 'ghost-button fullscreen-button'}
      onClick={toggle}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? ru.app.exitFullscreen : ru.app.fullscreen}
      title={isFullscreen ? ru.app.exitFullscreen : ru.app.fullscreen}
    >
      <span aria-hidden="true">⛶</span>
      {!compact && (isFullscreen ? ru.app.exitFullscreen : ru.app.fullscreen)}
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
    const saveTimer = window.setTimeout(() => saveGame(game), 120);
    return () => window.clearTimeout(saveTimer);
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
      <header className="game-topbar">
        <div className="game-club-identity">
          <div className="game-club-mark" style={{ background: club.color }}>{club.shortName}</div>
          <div className="game-club-copy">
            <strong>{club.name}</strong>
            <span>{club.city} · {ru.app.season} {game.season} · {ru.app.round} {game.currentRound}</span>
          </div>
        </div>

        <div className="game-topbar-actions">
          <button className="ghost-button" type="button" onClick={leaveToCareerMenu}>
            {ru.app.careers}
          </button>
          <FullscreenButton compact />
        </div>
      </header>

      <main className="content">
        <div className="workspace-grid">
          <section className={`workspace-main content-${tab}`}>
            {tab === 'overview' && (
              <Overview
                game={game}
                position={position}
                row={tableRow}
                nextFixture={nextFixture}
                onOpenSection={(section) => setTab(section)}
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

            {tab !== 'overview' && (
              <section className={`section-view section-view-${tab}`}>
                <div className="section-view-header">
                  <div>
                    <div className="eyebrow">РАЗДЕЛ</div>
                    <h1>{ru.tabs[tab]}</h1>
                  </div>
                  <button
                    className="section-view-close ghost-button"
                    type="button"
                    onClick={() => setTab('overview')}
                    aria-label={ru.common.close}
                  >
                    <span aria-hidden="true">←</span>
                    {ru.common.close}
                  </button>
                </div>

                <div className="section-view-body">
                  {tab === 'squad' && <Squad game={game} onChange={(nextGame) => setGame(nextGame)} />}
                  {tab === 'transfers' && <TransferMarket game={game} onChange={(nextGame) => setGame(nextGame)} />}
                  {tab === 'tactics' && (
                    <Tactics
                      game={game}
                      onChange={(tactic) => setGame({ ...game, clubs: { ...game.clubs, [club.id]: { ...club, tactic } } })}
                    />
                  )}
                  {tab === 'table' && <LeagueTable game={game} />}
                  {tab === 'finances' && <FinanceScreen game={game} />}
                </div>
              </section>
            )}
          </section>
        </div>
      </main>
      {matchCenter && (
        <LiveMatch
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
  onOpenSection,
  onPlay,
}: {
  game: GameState;
  position: number;
  row?: GameState['table'][number];
  nextFixture?: ReturnType<typeof getNextFixture>;
  onOpenSection: (section: Exclude<Tab, 'overview'>) => void;
  onPlay: () => void;
}) {
  const club = game.clubs[game.clubId];
  const lastMatch = game.lastMatch;
  const opponentId = nextFixture
    ? (nextFixture.homeTeamId === game.clubId ? nextFixture.awayTeamId : nextFixture.homeTeamId)
    : undefined;
  const opponent = opponentId ? game.clubs[opponentId] : undefined;
  const home = nextFixture?.homeTeamId === game.clubId;

  const menuCards: Array<{
    id: Exclude<Tab, 'overview'>;
    title: string;
    description: string;
    accent: string;
  }> = [
    { id: 'squad', title: ru.tabs.squad, description: ru.overview.sectionDescriptions.squad, accent: 'squad' },
    { id: 'transfers', title: ru.tabs.transfers, description: ru.overview.sectionDescriptions.transfers, accent: 'transfers' },
    { id: 'tactics', title: ru.tabs.tactics, description: ru.overview.sectionDescriptions.tactics, accent: 'tactics' },
    { id: 'table', title: ru.tabs.table, description: ru.overview.sectionDescriptions.table, accent: 'table' },
    { id: 'finances', title: ru.tabs.finances, description: ru.overview.sectionDescriptions.finances, accent: 'finances' },
  ];

  return (
    <div className="overview-home">
      <div className="overview-dashboard">
        <section className="card next-match">
          <div className="section-title-row next-match-header">
            <div>
              <div className="eyebrow">{ru.overview.nextMatch}</div>
              <h2>{nextFixture ? `${ru.overview.matchday} ${game.currentRound}` : ru.overview.seasonComplete}</h2>
            </div>
            {nextFixture && (
              <div className="next-match-meta">
                <span className="next-match-progress">{ru.overview.matchdayProgress(game.currentRound)}</span>
                <span className="match-tag">{home ? ru.overview.home : ru.overview.away}</span>
              </div>
            )}
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
              <button className="primary-button full" onClick={onPlay}>{ru.overview.playMatch}</button>
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

        <UpcomingCalendar game={game} />

        <section className="card last-match-card">
          <div className="eyebrow">{ru.overview.latestResult}</div>
          {lastMatch ? (
            <div className="latest-result">
              <div>{game.clubs[lastMatch.homeTeamId]?.shortName}</div>
              <strong>{lastMatch.homeGoals} : {lastMatch.awayGoals}</strong>
              <div>{game.clubs[lastMatch.awayTeamId]?.shortName}</div>
            </div>
          ) : <div className="empty-state">{ru.overview.firstMatch}</div>}

          {lastMatch && (
            <div className="mini-stats">
              <span>{ru.overview.shots} {lastMatch.homeShots} — {lastMatch.awayShots}</span>
            </div>
          )}
        </section>
      </div>

      <div className="overview-menu-grid">
        {menuCards.map((item) => (
          <button
            key={item.id}
            className={`card overview-menu-card overview-menu-card-${item.accent}`}
            type="button"
            onClick={() => onOpenSection(item.id)}
          >
            <div className="overview-menu-card-top">
              <div className="eyebrow">{ru.overview.menuLabel}</div>
              <span aria-hidden="true">→</span>
            </div>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function UpcomingCalendar({ game }: { game: GameState }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const fixtures = game.fixtures
    .filter((fixture) => fixture.round <= 14 && !fixture.played && (fixture.homeTeamId === game.clubId || fixture.awayTeamId === game.clubId))
    .sort((a, b) => a.round - b.round);

  const preview = fixtures.slice(0, 2);

  const calendarModal = calendarOpen ? (
    <div
      className="modal-backdrop calendar-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCalendarOpen(false);
      }}
    >
      <section className="modal-window calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
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
  ) : null;

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

      {calendarModal && createPortal(calendarModal, document.body)}
    </>
  );
}

function getLivePlayerSpots(team: 'home' | 'away', minute: number) {
  const base = [
    [50, 82], [18, 68], [38, 70], [62, 70], [82, 68],
    [28, 50], [50, 48], [72, 50],
    [22, 28], [50, 22], [78, 28],
  ];
  const direction = team === 'home' ? 1 : -1;
  const phase = minute / 7;
  return base.map(([left, top], index) => {
    const drift = Math.sin(phase + index * 1.7) * 3.4 * direction;
    const vertical = Math.cos(phase * 0.82 + index) * 2.4;
    const adjustedLeft = team === 'home' ? left + drift : 100 - left - drift;
    const adjustedTop = top + vertical;
    return {
      left: adjustedLeft,
      top: adjustedTop,
    };
  });
}

function LiveMatch({
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
  const [minute, setMinute] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (paused || finished) return;

    const timer = window.setInterval(() => {
      setMinute((current) => {
        if (current >= 90) {
          setFinished(true);
          return 90;
        }
        return Math.min(90, current + 1);
      });
    }, 350 / speed);

    return () => window.clearInterval(timer);
  }, [paused, speed, finished]);

  useEffect(() => {
    if (minute >= 90) setFinished(true);
  }, [minute]);

  const revealedEvents = match.events.filter((event) => event.minute <= minute);
  const visibleEvents = revealedEvents.slice(-7).reverse();
  const visibleGoals = revealedEvents.filter((event) => event.type === 'goal');
  const homeGoals = visibleGoals.filter((event) => event.teamId === match.homeTeamId).length;
  const awayGoals = visibleGoals.filter((event) => event.teamId === match.awayTeamId).length;
  const latestEvent = visibleEvents[0];
  const phase = finished
    ? 'full-time'
    : minute === 45
      ? 'half-time'
      : minute < 45
        ? 'first-half'
        : 'second-half';

  const home = game.clubs[match.homeTeamId];
  const away = game.clubs[match.awayTeamId];
  const homeSpots = getLivePlayerSpots('home', minute);
  const awaySpots = getLivePlayerSpots('away', minute);

  const ballEvent = latestEvent?.type === 'goal' ? latestEvent : revealedEvents[revealedEvents.length - 1];
  const ballTeamIsHome = ballEvent?.teamId === match.homeTeamId;
  const attackingHome = ballTeamIsHome ?? (Math.floor(minute / 5) % 2 === 0);
  const ballBaseX = attackingHome ? 61 + Math.sin(minute / 4) * 15 : 39 + Math.sin(minute / 4) * 15;
  const ballBaseY = 49 + Math.cos(minute / 5) * 18;

  const eventClass = (type: MatchResult['events'][number]['type']) => {
    if (type === 'goal') return 'live-event goal';
    if (type === 'chance') return 'live-event chance';
    if (type === 'yellow') return 'live-event yellow';
    if (type === 'injury') return 'live-event injury';
    return 'live-event';
  };

  return (
    <div className="live-match-backdrop" role="presentation">
      <section className="live-match-screen" role="dialog" aria-modal="true" aria-labelledby="live-match-title">
        <header className="live-match-topbar">
          <div className="live-match-competition">
            <span className="eyebrow">МАТЧ · СЕЗОН {season}</span>
            <strong id="live-match-title">Тур {round}</strong>
          </div>

          <div className="live-scoreboard">
            <div className="live-team-name home">
              <span className="live-team-badge" style={{ background: home?.color ?? '#50616d' }}>{home?.shortName ?? '—'}</span>
              <strong>{home?.name ?? '—'}</strong>
            </div>
            <div className="live-score">
              <strong>{homeGoals} : {awayGoals}</strong>
              <span>{minute}'</span>
            </div>
            <div className="live-team-name away">
              <strong>{away?.name ?? '—'}</strong>
              <span className="live-team-badge" style={{ background: away?.color ?? '#50616d' }}>{away?.shortName ?? '—'}</span>
            </div>
          </div>

          <div className="live-match-actions">
            <button className="ghost-button" type="button" onClick={() => setPaused((value) => !value)}>
              {paused ? 'Продолжить' : 'Пауза'}
            </button>
            <button className="ghost-button live-close-button" type="button" onClick={onClose}>
              {finished ? 'Закрыть' : 'Выйти'}
            </button>
          </div>
        </header>

        <div className="live-match-main">
          <div className="live-pitch" aria-label="Поле матча">
            <div className="live-pitch-halfway" />
            <div className="live-pitch-center-circle" />
            <div className="live-pitch-center-dot" />
            <div className="live-pitch-box live-pitch-box-top" />
            <div className="live-pitch-box live-pitch-box-bottom" />
            <div className="live-pitch-goal live-pitch-goal-top" />
            <div className="live-pitch-goal live-pitch-goal-bottom" />

            {homeSpots.map((spot, index) => (
              <span
                key={`home-${index}`}
                className="live-player home"
                style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
              />
            ))}
            {awaySpots.map((spot, index) => (
              <span
                key={`away-${index}`}
                className="live-player away"
                style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
              />
            ))}

            <span
              className={`live-ball ${latestEvent?.type === 'goal' ? 'is-event' : ''}`}
              style={{
                left: `${Math.max(8, Math.min(92, ballBaseX))}%`,
                top: `${Math.max(10, Math.min(90, ballBaseY))}%`,
              }}
            />

            {latestEvent && latestEvent.type !== 'half-time' && latestEvent.type !== 'full-time' && (
              <div className={`live-pitch-callout ${latestEvent.type}`}>
                <strong>{latestEvent.minute}'</strong>
                <span>{eventText(game, latestEvent)}</span>
              </div>
            )}

            {phase === 'half-time' && <div className="live-pitch-status">Перерыв</div>}
            {phase === 'full-time' && <div className="live-pitch-status">Матч завершён</div>}
          </div>

          <aside className="live-match-feed">
            <div className="live-feed-header">
              <div>
                <div className="eyebrow">ХОД МАТЧА</div>
                <h2>События</h2>
              </div>
              <span className="live-feed-phase">
                {phase === 'first-half' ? '1-й тайм' : phase === 'second-half' ? '2-й тайм' : phase === 'half-time' ? 'Перерыв' : 'Финал'}
              </span>
            </div>

            <div className="live-event-list">
              {visibleEvents.length ? visibleEvents.map((event) => (
                <div className={eventClass(event.type)} key={event.id}>
                  <strong>{event.minute}'</strong>
                  <span>{eventText(game, event)}</span>
                </div>
              )) : (
                <div className="live-event-empty">Матч только начался.</div>
              )}
            </div>
          </aside>
        </div>

        <footer className="live-match-footer">
          <div className="live-progress">
            <div className="live-progress-track">
              <span style={{ width: `${(minute / 90) * 100}%` }} />
            </div>
            <div className="live-progress-labels">
              <span>0'</span>
              <span>{latestEvent ? eventText(game, latestEvent) : 'Начало матча'}</span>
              <span>90'</span>
            </div>
          </div>

          <div className="live-footer-controls">
            <span className="live-speed-label">Скорость</span>
            <button
              className={speed === 1 ? 'live-speed active' : 'live-speed'}
              type="button"
              onClick={() => setSpeed(1)}
            >
              1×
            </button>
            <button
              className={speed === 2 ? 'live-speed active' : 'live-speed'}
              type="button"
              onClick={() => setSpeed(2)}
            >
              2×
            </button>
          </div>
        </footer>
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

type SquadPitchRole = 'keeper' | 'defender' | 'midfielder' | 'attacker';

type SquadSlot = {
  left: number;
  top: number;
  role: SquadPitchRole;
  label: string;
};

const squadFormationSlots: Record<Tactics['formation'], SquadSlot[]> = {
  '4-3-3': [
    { left: 50, top: 87, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 68, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 68, role: 'defender', label: 'ПЗ' },
    { left: 50, top: 50, role: 'midfielder', label: 'ОП' },
    { left: 31, top: 40, role: 'midfielder', label: 'ЦП' },
    { left: 69, top: 40, role: 'midfielder', label: 'ЦП' },
    { left: 15, top: 27, role: 'attacker', label: 'ЛФ' },
    { left: 50, top: 19, role: 'attacker', label: 'ЦН' },
    { left: 85, top: 27, role: 'attacker', label: 'ПФ' },
  ],
  '4-4-2': [
    { left: 50, top: 87, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 68, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 68, role: 'defender', label: 'ПЗ' },
    { left: 15, top: 46, role: 'midfielder', label: 'ЛП' },
    { left: 38, top: 46, role: 'midfielder', label: 'ЦП' },
    { left: 62, top: 46, role: 'midfielder', label: 'ЦП' },
    { left: 85, top: 46, role: 'midfielder', label: 'ПП' },
    { left: 38, top: 20, role: 'attacker', label: 'ЦН' },
    { left: 62, top: 20, role: 'attacker', label: 'ЦН' },
  ],
  '4-2-3-1': [
    { left: 50, top: 87, role: 'keeper', label: 'ВРТ' },
    { left: 15, top: 68, role: 'defender', label: 'ЛЗ' },
    { left: 38, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 62, top: 68, role: 'defender', label: 'ЦЗ' },
    { left: 85, top: 68, role: 'defender', label: 'ПЗ' },
    { left: 37, top: 50, role: 'midfielder', label: 'ОП' },
    { left: 63, top: 50, role: 'midfielder', label: 'ОП' },
    { left: 17, top: 34, role: 'attacker', label: 'ЛФ' },
    { left: 50, top: 31, role: 'attacker', label: 'АП' },
    { left: 83, top: 34, role: 'attacker', label: 'ПФ' },
    { left: 50, top: 18, role: 'attacker', label: 'ЦН' },
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
          <h2>{ru.tabs.squad}</h2>
        </div>
        <div className="squad-formation-pill">
          <strong>{club.tactic.formation}</strong>
        </div>
      </div>

      <div className="team-sheet">
        <div className="squad-pitch-wrap">
          <div className="squad-pitch">
            <svg className="pitch-markings" viewBox="0 0 68 68" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <clipPath id="pitch-penalty-arc-clip">
                  <rect x="0" y="0" width="68" height="46.63" />
                </clipPath>
              </defs>

              <path
                className="pitch-marking-boundary"
                d="M1.4 0 H66.6 Q68 0 68 1.81 V66.19 Q68 68 66.6 68 H1.4 Q0 68 0 66.19 V1.81 Q0 0 1.4 0 Z"
              />
              <circle className="pitch-marking-center-circle" cx="34" cy="0" r="9.15" />
              <circle className="pitch-marking-center-spot" cx="34" cy="0" r="0.22" />

              <path className="pitch-marking-penalty-area" d="M13.84 68 V46.63 H54.16 V68" />
              <path className="pitch-marking-goal-area" d="M23.34 68 V60.88 H44.66 V68" />
              <circle className="pitch-marking-penalty-spot" cx="34" cy="53.74" r="0.22" />
              <circle
                className="pitch-marking-penalty-arc"
                cx="34"
                cy="53.74"
                r="9.15"
                clipPath="url(#pitch-penalty-arc-clip)"
              />

              <path className="pitch-marking-goal-net" d="M30.34 68 H37.66 V66.25 H30.34 Z" />
              <line className="pitch-marking-goal-post" x1="30.34" y1="68" x2="30.34" y2="66.25" />
              <line className="pitch-marking-goal-post" x1="37.66" y1="68" x2="37.66" y2="66.25" />
              <line className="pitch-marking-goal-crossbar" x1="30.34" y1="66.25" x2="37.66" y2="66.25" />
            </svg>

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
        </div>

        <aside className={selectedSlot === null ? 'squad-roster' : 'squad-roster has-selection'}>
          <div className="squad-roster-header">
            <div>
              <strong>{ru.squad.substitutes} · {substitutes.length}</strong>
            </div>
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
        <div><h2>{ru.tabs.tactics}</h2></div>
      </div>

      <div className="formation-block compact-formation-selector">
        <div className="formation-heading">
          <div>
            <span>{ru.tactics.formation}</span>
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

type TableFormResult = 'W' | 'D' | 'L';

function getClubForm(game: GameState, teamId: string): TableFormResult[] {
  return game.fixtures
    .filter((fixture) =>
      fixture.played &&
      fixture.result &&
      (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId)
    )
    .sort((a, b) => b.round - a.round)
    .slice(0, 5)
    .map((fixture) => {
      const result = fixture.result!;
      const goalsFor = fixture.homeTeamId === teamId ? result.homeGoals : result.awayGoals;
      const goalsAgainst = fixture.homeTeamId === teamId ? result.awayGoals : result.homeGoals;
      return goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
    });
}

function TableForm({ results }: { results: TableFormResult[] }) {
  return (
    <div className="table-form" aria-label={ru.table.form}>
      {[...results].reverse().map((result, index) => (
        <span key={result + '-' + index} className={'table-form-dot ' + result}>
          {result}
        </span>
      ))}
      {!results.length && <span className="table-form-empty">—</span>}
    </div>
  );
}

function LeagueTable({ game }: { game: GameState }) {
  const rows = useMemo(() => [...game.table], [game.table]);
  const userRow = rows.find((row) => row.teamId === game.clubId);
  const userPosition = userRow ? rows.findIndex((row) => row.teamId === game.clubId) + 1 : 0;
  const userForm = useMemo(() => getClubForm(game, game.clubId), [game]);
  return (
    <section className="card content-card content-table">
      <div className="section-title-row table-page-header">
        <div>
          <h2>{ru.tabs.table}</h2>
        </div>
      </div>

      <div className="table-overview">
        <div className="table-overview-card position">
          <span>{ru.table.position}</span>
          <strong>{userPosition || '—'}<small>{userPosition ? ru.table.placeSuffix : ''}</small></strong>
        </div>
        <div className="table-overview-card points">
          <span>{ru.table.points}</span>
          <strong>{userRow?.points ?? 0}</strong>
        </div>
        <div className="table-overview-card matches">
          <span>{ru.table.played}</span>
          <strong>{userRow?.played ?? 0}<small>/ 14</small></strong>
        </div>
        <div className="table-overview-card goal-difference">
          <span>{ru.table.goalDifference}</span>
          <strong>{(userRow ? userRow.goalsFor - userRow.goalsAgainst : 0) > 0 ? '+' : ''}{userRow ? userRow.goalsFor - userRow.goalsAgainst : 0}</strong>
        </div>
        <div className="table-overview-card form">
          <span>{ru.table.form}</span>
          <TableForm results={userForm} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label={ru.table.position}></th>
              <th>{ru.table.club}</th>
              <th>{ru.table.form}</th>
              <th>{ru.table.played}</th>
              <th>{ru.table.wins}</th>
              <th>{ru.table.draws}</th>
              <th>{ru.table.losses}</th>
              <th>{ru.table.goalsFor}</th>
              <th>{ru.table.goalsAgainst}</th>
              <th>{ru.table.goalDifference}</th>
              <th>{ru.table.points}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowClub = game.clubs[row.teamId];
              const form = getClubForm(game, row.teamId);
              const goalDifference = row.goalsFor - row.goalsAgainst;
              return (
                <tr className={row.teamId === game.clubId ? 'your-club' : ''} key={row.teamId}>
                  <td>
                    <span className={index === 0 ? 'table-rank top' : index < 4 ? 'table-rank upper' : 'table-rank'}>
                      {index + 1}
                    </span>
                  </td>
                  <td>
                    <div className="table-club-cell">
                      <strong>{rowClub.name}</strong>
                    </div>
                  </td>
                  <td><TableForm results={form} /></td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
                  <td>{row.goalsFor}</td>
                  <td>{row.goalsAgainst}</td>
                  <td className={goalDifference > 0 ? 'goal-positive' : goalDifference < 0 ? 'goal-negative' : ''}>
                    {goalDifference > 0 ? '+' : ''}{goalDifference}
                  </td>
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

function FinanceScreen({ game }: { game: GameState }) {
  const club = game.clubs[game.clubId];
  const finance: ClubFinance = club.finance ?? {
    seasonIncome: 0,
    seasonExpenses: 0,
    seasonTransferIncome: 0,
    seasonTransferExpenses: 0,
    seasonContractExpenses: 0,
    lastIncome: 0,
    lastExpenses: 0,
    lastNet: 0,
    lastMatchdayIncome: 0,
    lastBroadcastIncome: 0,
    lastResultBonus: 0,
    lastTransferIncome: 0,
    lastTransferExpense: 0,
    lastContractExpense: 0,
  };
  const net = finance.lastNet;
  const hasActivity = finance.lastIncome > 0 || finance.lastExpenses > 0;
  const totalIncome = finance.seasonIncome + finance.seasonTransferIncome;
  const totalExpenses = finance.seasonExpenses + finance.seasonTransferExpenses + finance.seasonContractExpenses;
  const seasonBalance = totalIncome - totalExpenses;

  return (
    <section className="card content-card finance-page">
      <div className="section-title-row">
        <div>
          <h2>{ru.financesPage.title}</h2>
        </div>
      </div>

      <div className="finance-hero">
        <div>
          <span>{ru.financesPage.budget}</span>
          <strong>{formatMoney(club.budget)}</strong>
        </div>
        <div className="finance-hero-wages">
          <span>{ru.financesPage.wages}</span>
          <strong>{formatMoney(club.wages)}</strong>
        </div>
      </div>

      <div className="finance-season-grid">
        <section className="finance-season-card income">
          <div className="finance-season-card-header">
            <div>
              <span>{ru.financesPage.income}</span>
              <strong>{formatMoney(totalIncome)}</strong>
            </div>
          </div>
          <div className="finance-season-rows">
            <div>
              <span>{ru.financesPage.income}</span>
              <strong>+{formatMoney(finance.seasonIncome)}</strong>
            </div>
            <div>
              <span>{ru.financesPage.transferIncome}</span>
              <strong>+{formatMoney(finance.seasonTransferIncome)}</strong>
            </div>
          </div>
        </section>

        <section className="finance-season-card expenses">
          <div className="finance-season-card-header">
            <div>
              <span>{ru.financesPage.expenses}</span>
              <strong>{formatMoney(totalExpenses)}</strong>
            </div>
          </div>
          <div className="finance-season-rows">
            <div>
              <span>{ru.financesPage.wages}</span>
              <strong>-{formatMoney(finance.seasonExpenses)}</strong>
            </div>
            <div>
              <span>{ru.financesPage.transferExpenses}</span>
              <strong>-{formatMoney(finance.seasonTransferExpenses)}</strong>
            </div>
            <div>
              <span>{ru.financesPage.contractExpenses}</span>
              <strong>-{formatMoney(finance.seasonContractExpenses)}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className={seasonBalance >= 0 ? 'finance-season-balance positive' : 'finance-season-balance negative'}>
        <div>
          <span>{ru.financesPage.seasonBalance}</span>
          <strong>{seasonBalance >= 0 ? '+' : ''}{formatMoney(seasonBalance)}</strong>
        </div>
      </div>

      <div className="finance-round-card finance-section">
        <div className="section-title-row finance-round-header">
          <div>
            <h2>{ru.financesPage.lastRound}</h2>
          </div>
        </div>

        {hasActivity ? (
          <div className="finance-ledger finance-ledger-round">
            <section className="finance-ledger-section finance-ledger-card income">
              <div className="finance-ledger-total">
                <div>
                  <span>{ru.financesPage.incomeLabel}</span>
                  <strong>+{formatMoney(finance.lastIncome)}</strong>
                </div>
              </div>
              <div className="finance-ledger-rows">
                <div><span>{ru.financesPage.matchdayIncome}</span><strong>+{formatMoney(finance.lastMatchdayIncome)}</strong></div>
                <div><span>{ru.financesPage.broadcastIncome}</span><strong>+{formatMoney(finance.lastBroadcastIncome)}</strong></div>
                <div><span>{ru.financesPage.resultBonus}</span><strong>+{formatMoney(finance.lastResultBonus)}</strong></div>
              </div>
            </section>

            <section className="finance-ledger-section finance-ledger-card expenses">
              <div className="finance-ledger-total">
                <div>
                  <span>{ru.financesPage.expenseLabel}</span>
                  <strong>-{formatMoney(finance.lastExpenses)}</strong>
                </div>
              </div>
              <div className="finance-ledger-rows">
                <div><span>{ru.financesPage.wageExpense}</span><strong>-{formatMoney(finance.lastExpenses)}</strong></div>
              </div>
            </section>

            <section className={net >= 0 ? 'finance-ledger-section finance-ledger-card result positive' : 'finance-ledger-section finance-ledger-card result negative'}>
              <div className="finance-ledger-result-inner">
                <span>{ru.financesPage.roundResult}</span>
                <strong>{net >= 0 ? '+' : ''}{formatMoney(net)}</strong>
              </div>
            </section>
          </div>
        ) : (
          <div className="finance-empty">{ru.financesPage.noActivity}</div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return <div className="big-stat"><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>;
}

export default App;