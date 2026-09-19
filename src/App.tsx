import { useEffect, useMemo, useState } from 'react';
import type { GameState, Tactics } from './domain/types';
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
    setManagerName('');
  };

  const openCareer = (career: StoredCareer) => {
    setGame(career.state);
    setTab('overview');
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
            onPlay={() => setGame(playNextRound(game))}
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
        <div className="future-note">{ru.overview.futureNote}</div>
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
    { left: 50, top: 89, role: 'keeper', label: 'GK' },
    { left: 15, top: 71, role: 'defender', label: 'LB' },
    { left: 38, top: 71, role: 'defender', label: 'CB' },
    { left: 62, top: 71, role: 'defender', label: 'CB' },
    { left: 85, top: 71, role: 'defender', label: 'RB' },
    { left: 50, top: 53, role: 'midfielder', label: 'DM' },
    { left: 31, top: 43, role: 'midfielder', label: 'CM' },
    { left: 69, top: 43, role: 'midfielder', label: 'CM' },
    { left: 15, top: 21, role: 'attacker', label: 'LW' },
    { left: 50, top: 15, role: 'attacker', label: 'CF' },
    { left: 85, top: 21, role: 'attacker', label: 'RW' },
  ],
  '4-4-2': [
    { left: 50, top: 89, role: 'keeper', label: 'GK' },
    { left: 15, top: 71, role: 'defender', label: 'LB' },
    { left: 38, top: 71, role: 'defender', label: 'CB' },
    { left: 62, top: 71, role: 'defender', label: 'CB' },
    { left: 85, top: 71, role: 'defender', label: 'RB' },
    { left: 15, top: 48, role: 'midfielder', label: 'LM' },
    { left: 38, top: 48, role: 'midfielder', label: 'CM' },
    { left: 62, top: 48, role: 'midfielder', label: 'CM' },
    { left: 85, top: 48, role: 'midfielder', label: 'RM' },
    { left: 38, top: 18, role: 'attacker', label: 'ST' },
    { left: 62, top: 18, role: 'attacker', label: 'ST' },
  ],
  '4-2-3-1': [
    { left: 50, top: 89, role: 'keeper', label: 'GK' },
    { left: 15, top: 71, role: 'defender', label: 'LB' },
    { left: 38, top: 71, role: 'defender', label: 'CB' },
    { left: 62, top: 71, role: 'defender', label: 'CB' },
    { left: 85, top: 71, role: 'defender', label: 'RB' },
    { left: 37, top: 53, role: 'midfielder', label: 'DM' },
    { left: 63, top: 53, role: 'midfielder', label: 'DM' },
    { left: 17, top: 34, role: 'attacker', label: 'LW' },
    { left: 50, top: 31, role: 'attacker', label: 'AM' },
    { left: 83, top: 34, role: 'attacker', label: 'RW' },
    { left: 50, top: 14, role: 'attacker', label: 'ST' },
  ],
};

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
              return (
                <button
                  key={slot.label + '-' + index + '-' + player.id}
                  type="button"
                  className={selected ? 'squad-player-marker selected' : 'squad-player-marker'}
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
            {selectedSlot === null ? ru.squad.selectPlayer : ru.squad.swapHint}
          </div>
        </div>

        <aside className="squad-roster">
          <div className="squad-roster-header">
            <div>
              <div className="eyebrow">{ru.squad.roster}</div>
              <strong>{ru.squad.players} · {roster.length}</strong>
            </div>
            <span>{ru.squad.startingXI}</span>
          </div>

          <div className="squad-roster-list">
            {roster.map((player) => {
              const slotIndex = lineupIds.indexOf(player.id);
              const onPitch = slotIndex >= 0;
              const selected = selectedSlot !== null && slotIndex === selectedSlot;
              return (
                <button
                  key={player.id}
                  type="button"
                  className={selected ? 'squad-roster-card selected' : onPitch ? 'squad-roster-card' : 'squad-roster-card reserve'}
                  onClick={() => handleRosterClick(player.id)}
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
                  <span className={`squad-roster-stat squad-fitness squad-fitness-${player.fitness >= 75 ? 'high' : player.fitness >= 50 ? 'medium' : 'low'}`}>
                    <small>{ru.squad.fitness}</small>
                    <strong>{player.fitness}</strong>
                  </span>
                  <span className={onPitch ? 'squad-roster-status active' : 'squad-roster-status'}>
                    {onPitch ? ru.squad.starting : ru.squad.reserve}
                  </span>
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
