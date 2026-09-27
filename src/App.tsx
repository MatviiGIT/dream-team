import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClubFinance, GameState, MatchResult, Player, Position, Tactics } from './domain/types';
import { clubOrder } from './data/initialWorld';
import { createCareer, getNextFixture, playNextRound } from './game/career';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';
import { ru } from './i18n/ru';
import { TransferMarket } from './components/TransferMarket';

const tabs = ['squad', 'transfers', 'table', 'finances'] as const;
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
  const [matchCenter, setMatchCenter] = useState<{
    match: MatchResult;
    season: number;
    round: number;
    nextGame: GameState;
  } | null>(null);
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
    <div className={`wsc-app-shell wsc-app-${tab}`}>
      <header className="wsc-app-header">
        <button
          className="wsc-header-menu"
          type="button"
          onClick={() => setTab('overview')}
          aria-label={ru.common.close}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="wsc-header-club">
          <div className="wsc-header-crest" style={{ background: club.color }}>{club.shortName}</div>
          <div className="wsc-header-club-copy">
            <strong>{club.name}</strong>
            <span>{ru.app.season} {game.season} · {ru.app.round} {game.currentRound}</span>
          </div>
        </div>

        <nav className="wsc-header-nav" aria-label="Разделы">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? 'wsc-header-nav-item active' : 'wsc-header-nav-item'}
              onClick={() => setTab(item)}
            >
              {ru.tabs[item]}
            </button>
          ))}
        </nav>

        <div className="wsc-header-spacer" />

        <button className="wsc-header-icon" type="button" onClick={leaveToCareerMenu} aria-label={ru.app.careers}>
          ↩
        </button>
        <FullscreenButton compact />
      </header>

      <main className="wsc-app-content">
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
              if (nextGame.lastMatch) {
                setMatchCenter({
                  match: nextGame.lastMatch,
                  season: matchSeason,
                  round: matchRound,
                  nextGame,
                });
              }
            }}
          />
        )}

        {tab !== 'overview' && (
          <section className={`wsc-section wsc-section-${tab}`}>
            <div className="wsc-section-topline">
              <button
                className="wsc-back-button"
                type="button"
                onClick={() => setTab('overview')}
              >
                ‹
              </button>
              <div>
                <span>КЛУБ</span>
                <h1>{ru.tabs[tab]}</h1>
              </div>
            </div>

            <div className="wsc-section-body">
              {tab === 'squad' && <Squad game={game} onChange={(nextGame) => setGame(nextGame)} />}
              {tab === 'transfers' && <TransferMarket game={game} onChange={(nextGame) => setGame(nextGame)} />}
              {tab === 'table' && <LeagueTable game={game} />}
              {tab === 'finances' && <FinanceScreen game={game} />}
            </div>
          </section>
        )}
      </main>

      {matchCenter && (
        <LiveMatch
          game={game}
          match={matchCenter.match}
          season={matchCenter.season}
          round={matchCenter.round}
          onClose={() => {
            setGame(matchCenter.nextGame);
            setMatchCenter(null);
          }}
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
  const [newCareerOpen, setNewCareerOpen] = useState(false);

  return (
    <div className="wsc-start-screen">
      <div className="wsc-start-stage">
        <header className="wsc-brand-bar">
          <div className="wsc-brand-lockup">
            <div className="wsc-brand-wordmark">DREAM <span>TEAM</span></div>
            <div className="wsc-brand-ball">●</div>
          </div>

          <div className="wsc-start-actions">
            <button className="wsc-round-button" type="button" onClick={() => setSettingsOpen(true)} aria-label={ru.settings.openButton}>
              ⚙
            </button>
            <FullscreenButton compact />
          </div>
        </header>

        <main className="wsc-start-main">
          <section className="wsc-save-side">
            <div className="wsc-section-ribbon">
              <span>СОХРАНЕНИЯ</span>
              <strong>{props.careers.length}</strong>
            </div>

            {props.careers.length ? (
              <div className="wsc-save-list">
                {props.careers.map((career, index) => (
                  <article className="wsc-save-slot" key={career.id}>
                    <div className="wsc-slot-number">{index + 1}</div>
                    <div
                      className="wsc-slot-club"
                      style={{ background: career.state.clubs[career.state.clubId]?.color ?? '#63d6c0' }}
                    >
                      {career.state.clubs[career.state.clubId]?.shortName ?? 'DT'}
                    </div>
                    <div className="wsc-slot-copy">
                      <strong>{career.managerName}</strong>
                      <span>{career.clubName}</span>
                      <small>{ru.app.season} {career.state.season} · {ru.app.round} {career.state.currentRound}</small>
                    </div>
                    <div className="wsc-slot-actions">
                      <button className="wsc-slot-play" type="button" onClick={() => props.onOpen(career)}>
                        ▶
                      </button>
                      <button
                        className="wsc-slot-delete"
                        type="button"
                        onClick={() => setDeleteTarget(career)}
                        aria-label={ru.career.delete}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="wsc-empty-slot">
                <div className="wsc-empty-icon">＋</div>
                <strong>НЕТ СОХРАНЕНИЙ</strong>
                <span>Создай карьеру, чтобы она появилась здесь.</span>
              </div>
            )}

            <button className="wsc-main-button secondary" type="button" onClick={() => setNewCareerOpen(true)}>
              <span className="wsc-button-icon">＋</span>
              НОВАЯ КАРЬЕРА
            </button>
          </section>

          <section className="wsc-start-hero">
            <div className="wsc-hero-kicker">БРАУЗЕРНЫЙ ФУТБОЛЬНЫЙ МЕНЕДЖЕР</div>
            <h1>DREAM<br /><span>TEAM</span></h1>
            <p>Одна футбольная вселенная. Сезоны идут, клубы меняются, молодые игроки приходят, ветераны уходят.</p>

            <div className="wsc-hero-buttons">
              {props.careers.length > 0 && (
                <button className="wsc-main-button primary" type="button" onClick={() => props.onOpen(props.careers[0])}>
                  <span className="wsc-button-icon">▶</span>
                  ПРОДОЛЖИТЬ
                </button>
              )}
              <button className="wsc-main-button ghost" type="button" onClick={() => setNewCareerOpen(true)}>
                <span className="wsc-button-icon">＋</span>
                НАЧАТЬ НОВУЮ
              </button>
            </div>

            <div className="wsc-hero-note">SEASON {props.careers[0]?.state.season ?? 1} · FOOTBALL WORLD</div>
          </section>
        </main>

        {newCareerOpen && (
          <div className="wsc-overlay">
            <section className="wsc-new-career-panel" role="dialog" aria-modal="true" aria-labelledby="new-career-title">
              <div className="wsc-panel-title">
                <div>
                  <span>НОВАЯ КАРЬЕРА</span>
                  <h2 id="new-career-title">Начни свой путь</h2>
                </div>
                <button className="wsc-panel-close" type="button" onClick={() => setNewCareerOpen(false)} aria-label={ru.common.close}>×</button>
              </div>

              <div className="wsc-form">
                <label>
                  ИМЯ ТРЕНЕРА
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
                  СТАРТОВЫЙ КЛУБ
                  <select value={props.selectedClub} onChange={(event) => props.setSelectedClub(event.target.value)}>
                    {clubOrder.map((id) => <option key={id} value={id}>{clubLabels[id]}</option>)}
                  </select>
                </label>

                <button
                  className="wsc-main-button primary"
                  type="button"
                  onClick={() => {
                    props.onStart();
                    setNewCareerOpen(false);
                  }}
                >
                  <span className="wsc-button-icon">▶</span>
                  {ru.career.startButton.toUpperCase()}
                </button>
              </div>
            </section>
          </div>
        )}

        {deleteTarget && (
          <div
            className="wsc-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDeleteTarget(null);
            }}
          >
            <section className="wsc-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="delete-career-title">
              <div className="wsc-panel-title">
                <div>
                  <span>ПОДТВЕРЖДЕНИЕ</span>
                  <h2 id="delete-career-title">Удалить сохранение?</h2>
                </div>
                <button className="wsc-panel-close" type="button" onClick={() => setDeleteTarget(null)} aria-label={ru.common.close}>×</button>
              </div>
              <p>Удалить карьеру тренера «{deleteTarget.managerName}»?</p>
              <div className="wsc-confirm-actions">
                <button className="wsc-main-button ghost" type="button" onClick={() => setDeleteTarget(null)}>
                  ОТМЕНА
                </button>
                <button
                  className="wsc-main-button danger"
                  type="button"
                  onClick={() => {
                    props.onDelete(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                >
                  УДАЛИТЬ
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
  const roster = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  const squadEnergy = roster.length
    ? Math.round(roster.reduce((sum, player) => sum + player.fitness, 0) / roster.length)
    : 0;

  return (
    <div className="wsc-home-screen">
      <div className="wsc-week-strip">
        <span>{ru.app.season} {game.season} · НЕДЕЛЯ {game.currentRound}</span>
        <span>{position} МЕСТО · {row?.points ?? 0} ОЧКОВ</span>
      </div>

      <div className="wsc-home-grid">
        <main className="wsc-home-primary">
          <section className="wsc-tile wsc-next-match-tile">
            <div className="wsc-tile-title">
              <div><span>СЛЕДУЮЩИЙ МАТЧ</span><strong>{nextFixture ? 'ТУР ' + game.currentRound : ru.overview.seasonComplete}</strong></div>
              {nextFixture && <b>{home ? '(H)' : '(A)'}</b>}
            </div>

            {opponent ? (
              <>
                <div className="wsc-next-match-body">
                  <div className="wsc-next-match-club">
                    <div className="wsc-big-crest" style={{ background: club.color }}>{club.shortName}</div>
                    <strong>{club.name}</strong>
                  </div>
                  <div className="wsc-next-match-center">
                    <span>VS</span>
                    <small>{home ? 'ДОМА' : 'ГОСТИ'}</small>
                  </div>
                  <div className="wsc-next-match-club">
                    <div className="wsc-big-crest" style={{ background: opponent.color }}>{opponent.shortName}</div>
                    <strong>{opponent.name}</strong>
                  </div>
                </div>
                <div className="wsc-next-match-ratings">
                  <span>ЗАЩ {Math.round(roster.filter((p) => p.position === 'DEF').reduce((a,p) => a+p.overall,0) / Math.max(1, roster.filter((p) => p.position === 'DEF').length))}</span>
                  <span>ПЗЩ {Math.round(roster.filter((p) => p.position === 'MID').reduce((a,p) => a+p.overall,0) / Math.max(1, roster.filter((p) => p.position === 'MID').length))}</span>
                  <span>НАП {Math.round(roster.filter((p) => p.position === 'FWD').reduce((a,p) => a+p.overall,0) / Math.max(1, roster.filter((p) => p.position === 'FWD').length))}</span>
                </div>
                <button className="wsc-green-action" type="button" onClick={onPlay}>▶ ИГРАТЬ МАТЧ</button>
              </>
            ) : <div className="wsc-empty-panel">{ru.overview.noMatch}</div>}
          </section>

          <section className="wsc-tile wsc-schedule-tile">
            <div className="wsc-tile-title"><div><span>РАСПИСАНИЕ</span><strong>БЛИЖАЙШИЕ МАТЧИ</strong></div><button type="button" onClick={() => document.querySelector<HTMLButtonElement>('.calendar-preview')?.click()}>›</button></div>
            <UpcomingCalendar game={game} />
          </section>
        </main>

        <aside className="wsc-home-secondary">
          <button className="wsc-tile wsc-team-tile" type="button" onClick={() => onOpenSection('squad')}>
            <div className="wsc-tile-title"><div><span>КОМАНДА</span><strong>УПРАВЛЕНИЕ КОМАНДОЙ</strong></div><b>›</b></div>
            <div className="wsc-team-preview">
              <div className="wsc-mini-pitch">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="wsc-team-summary">
                <strong>{club.tactic.formation}</strong>
                <span>ЭНЕРГИЯ: {squadEnergy}%</span>
                <span>ПОЗИЦИЙ: {roster.length}</span>
              </div>
            </div>
          </button>

          <div className="wsc-two-actions">
            <button className="wsc-tile wsc-action-tile" type="button" onClick={() => onOpenSection('transfers')}>
              <span>ТРАНСФЕРЫ</span><strong>КУПИТЬ</strong><b>›</b>
            </button>
            <button className="wsc-tile wsc-action-tile" type="button" onClick={() => onOpenSection('transfers')}>
              <span>ТРАНСФЕРЫ</span><strong>ПРОДАТЬ</strong><b>›</b>
            </button>
          </div>

          <div className="wsc-two-actions">
            <button className="wsc-tile wsc-action-tile" type="button" onClick={() => onOpenSection('table')}>
              <span>ЧЕМПИОНАТ</span><strong>ТАБЛИЦА</strong><b>›</b>
            </button>
            <button className="wsc-tile wsc-action-tile" type="button" onClick={() => onOpenSection('finances')}>
              <span>КЛУБ</span><strong>ФИНАНСЫ</strong><b>›</b>
            </button>
          </div>

          {lastMatch && (
            <section className="wsc-last-tile">
              <span>ПОСЛЕДНИЙ РЕЗУЛЬТАТ</span>
              <div><strong>{game.clubs[lastMatch.homeTeamId]?.shortName}</strong><b>{lastMatch.homeGoals}:{lastMatch.awayGoals}</b><strong>{game.clubs[lastMatch.awayTeamId]?.shortName}</strong></div>
            </section>
          )}
        </aside>
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
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setMinute((current) => {
        if (current >= 90) {
          setFinished(true);
          return 90;
        }
        return current + 1;
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (minute >= 90) setFinished(true);
  }, [minute]);

  const revealedEvents = match.events.filter((event) => event.minute <= minute);
  const matchEvents = revealedEvents.filter((event) => event.type !== 'half-time' && event.type !== 'full-time');
  const recentEvents = matchEvents.slice(-8).reverse();
  const latestEvent = matchEvents[matchEvents.length - 1];

  const visibleGoals = revealedEvents.filter((event) => event.type === 'goal');
  const homeGoals = visibleGoals.filter((event) => event.teamId === match.homeTeamId).length;
  const awayGoals = visibleGoals.filter((event) => event.teamId === match.awayTeamId).length;

  const home = game.clubs[match.homeTeamId];
  const away = game.clubs[match.awayTeamId];
  const homeTeamName = home?.name ?? '—';
  const awayTeamName = away?.name ?? '—';

  const currentPhase = finished
    ? ru.liveMatch.fullTime
    : minute < 45
      ? ru.liveMatch.firstHalf
      : minute === 45
        ? ru.liveMatch.halfTime
        : ru.liveMatch.secondHalf;

  const eventClass = (type: MatchResult['events'][number]['type']) => {
    if (type === 'goal') return 'live-event goal';
    if (type === 'chance') return 'live-event chance';
    if (type === 'yellow') return 'live-event yellow';
    if (type === 'injury') return 'live-event injury';
    if (type === 'substitution') return 'live-event substitution';
    return 'live-event';
  };

  const eventIcon = (type: MatchResult['events'][number]['type']) => {
    if (type === 'goal') return '⚽';
    if (type === 'yellow') return '🟨';
    if (type === 'injury') return '✚';
    if (type === 'substitution') return '↕';
    if (type === 'chance') return '◉';
    return '•';
  };

  return (
    <div className="live-match-backdrop" role="presentation">
      <section className="live-match-screen" role="dialog" aria-modal="true" aria-labelledby="live-match-title">
        <header className="live-match-topbar">
          <div className="live-match-competition">
            <div className="eyebrow">{ru.liveMatch.eyebrow}</div>
            <strong>{ru.liveMatch.season} {season} · {ru.liveMatch.round} {round}</strong>
          </div>
          <div className="live-match-status-pill">
            <span className={finished ? 'status-dot finished' : 'status-dot'} />
            {currentPhase}
          </div>
          {finished ? (
            <button className="ghost-button live-close-button" type="button" onClick={onClose}>
              {ru.liveMatch.close}
            </button>
          ) : (
            <div className="live-auto-label">АВТОМАТИЧЕСКИЙ МАТЧ</div>
          )}
        </header>

        <main className="live-match-content">
          <section className="live-score-card">
            <div className="live-score-card-heading">
              <span>МАТЧ</span>
              <strong>{minute}'</strong>
            </div>

            <div className="live-score-teams">
              <div className="live-score-team">
                <div
                  className="live-team-badge large"
                  style={{ background: home?.color ?? '#50616d' }}
                >
                  {home?.shortName ?? '—'}
                </div>
                <strong>{homeTeamName}</strong>
                <span>{ru.liveMatch.home}</span>
              </div>

              <div className="live-score-main">
                <strong>{homeGoals} : {awayGoals}</strong>
                <span>{finished ? ru.liveMatch.fullTime : currentPhase}</span>
              </div>

              <div className="live-score-team away">
                <div
                  className="live-team-badge large"
                  style={{ background: away?.color ?? '#50616d' }}
                >
                  {away?.shortName ?? '—'}
                </div>
                <strong>{awayTeamName}</strong>
                <span>{ru.liveMatch.away}</span>
              </div>
            </div>

            <div className="live-match-progress">
              <span style={{ width: `${(minute / 90) * 100}%` }} />
            </div>
          </section>

          <section className="live-match-grid">
            <article className="live-match-card live-current-card">
              <div className="live-card-header">
                <div>
                  <div className="eyebrow">{ru.liveMatch.matchEvents}</div>
                  <h2>Последнее событие</h2>
                </div>
                <span className="live-minute-chip">{latestEvent ? `${latestEvent.minute}'` : "0'"}</span>
              </div>

              <div className={latestEvent ? `live-current-event ${latestEvent.type}` : 'live-current-event empty'}>
                <div className="live-current-event-icon">
                  {latestEvent ? eventIcon(latestEvent.type) : '⚽'}
                </div>
                <div>
                  <strong>{latestEvent ? eventText(game, latestEvent) : ru.liveMatch.started}</strong>
                  <span>
                    {latestEvent
                      ? latestEvent.description
                      : ru.liveMatch.kickOff}
                  </span>
                </div>
              </div>

              <div className="live-score-mini">
                <span>{homeTeamName}</span>
                <strong>{homeGoals} : {awayGoals}</strong>
                <span>{awayTeamName}</span>
              </div>
            </article>

            <article className="live-match-card live-timeline-card">
              <div className="live-card-header">
                <div>
                  <div className="eyebrow">{ru.liveMatch.matchFlow}</div>
                  <h2>Хронология</h2>
                </div>
                <span className="live-total-events">{matchEvents.length}</span>
              </div>

              <div className="live-timeline-list">
                {recentEvents.length ? recentEvents.map((event) => {
                  const isHome = event.teamId === match.homeTeamId;
                  return (
                    <div className={`live-timeline-row ${isHome ? 'home' : 'away'}`} key={event.id}>
                      <span className="live-timeline-minute">{event.minute}'</span>
                      <span className={eventClass(event.type)}>{eventIcon(event.type)}</span>
                      <div className="live-timeline-copy">
                        <strong>{eventText(game, event)}</strong>
                        <span>{event.description}</span>
                      </div>
                      <span className="live-timeline-team">{isHome ? home?.shortName : away?.shortName}</span>
                    </div>
                  );
                }) : (
                  <div className="live-timeline-empty">{ru.liveMatch.started}</div>
                )}
              </div>
            </article>

            <article className="live-match-card live-breakdown-card">
              <div className="live-card-header">
                <div>
                  <div className="eyebrow">ХОД ИГРЫ</div>
                  <h2>Матч по минутам</h2>
                </div>
              </div>

              <div className="live-minute-blocks">
                <div className={`live-half-block ${minute < 45 ? 'active' : ''}`}>
                  <span>1</span>
                  <strong>1-й тайм</strong>
                  <small>0' — 45'</small>
                </div>
                <div className={`live-half-block ${minute >= 45 && minute < 90 ? 'active' : ''}`}>
                  <span>2</span>
                  <strong>2-й тайм</strong>
                  <small>45' — 90'</small>
                </div>
              </div>

              <div className="live-key-events">
                <div><span>Голы</span><strong>{visibleGoals.length}</strong></div>
                <div><span>События</span><strong>{matchEvents.length}</strong></div>
                <div><span>Минута</span><strong>{minute}'</strong></div>
              </div>
            </article>
          </section>
        </main>

        <footer className="live-match-footer">
          <div className="live-footer-left">
            <span className="live-auto-dot" />
            <span>{finished ? ru.liveMatch.fullTime : 'Результат появляется автоматически по минутам'}</span>
          </div>
          <div className="live-footer-right">
            <span>0'</span>
            <div className="live-footer-track"><span style={{ width: `${(minute / 90) * 100}%` }} /></div>
            <span>90'</span>
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
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const roster = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  const initialXI = club.startingXI?.length === 11 ? club.startingXI : club.playerIds.slice(0, 11);
  const [lineupIds, setLineupIds] = useState<string[]>(initialXI);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [openTactic, setOpenTactic] = useState<TacticSettingKey | null>(null);

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
          <span className="wsc-screen-caption">{club.name} · {game.managerName}</span>
        </div>
        <div className="squad-formation-pill">
          <strong>{club.tactic.formation}</strong>
        </div>
      </div>

      <div className="squad-tactics-bar">
        <div className="squad-tactics-caption">
          <span>СХЕМА И ТАКТИКА</span>
          <strong>{club.tactic.formation}</strong>
        </div>
        <div className="squad-formation-buttons">
          {(['4-3-3', '4-4-2', '4-2-3-1'] as Tactics['formation'][]).map((formation) => (
            <button
              key={formation}
              type="button"
              className={club.tactic.formation === formation ? 'active' : ''}
              onClick={() => onChange({
                ...game,
                clubs: { ...game.clubs, [club.id]: { ...club, tactic: { ...club.tactic, formation } } },
              })}
            >
              {formation}
            </button>
          ))}
        </div>
        <div className="squad-tactic-choices">
          {([
            {
              key: 'mentality' as TacticSettingKey,
              label: ru.tactics.mentality,
              options: [
                { value: 'Very Defensive', label: ru.tactics.options.veryDefensive },
                { value: 'Defensive', label: ru.tactics.options.defensive },
                { value: 'Balanced', label: ru.tactics.options.balanced },
                { value: 'Attacking', label: ru.tactics.options.attacking },
                { value: 'Very Attacking', label: ru.tactics.options.veryAttacking },
              ],
            },
            {
              key: 'tempo' as TacticSettingKey,
              label: ru.tactics.tempo,
              options: [
                { value: 'Slow', label: ru.tactics.options.slow },
                { value: 'Normal', label: ru.tactics.options.normal },
                { value: 'Fast', label: ru.tactics.options.fast },
              ],
            },
            {
              key: 'pressing' as TacticSettingKey,
              label: ru.tactics.pressing,
              options: [
                { value: 'Low', label: ru.tactics.options.low },
                { value: 'Medium', label: ru.tactics.options.medium },
                { value: 'High', label: ru.tactics.options.high },
              ],
            },
            {
              key: 'defensiveLine' as TacticSettingKey,
              label: ru.tactics.defensiveLine,
              options: [
                { value: 'Low', label: ru.tactics.options.low },
                { value: 'Normal', label: ru.tactics.options.normal },
                { value: 'High', label: ru.tactics.options.high },
              ],
            },
            {
              key: 'width' as TacticSettingKey,
              label: ru.tactics.width,
              options: [
                { value: 'Narrow', label: ru.tactics.options.narrow },
                { value: 'Balanced', label: ru.tactics.options.balanced },
                { value: 'Wide', label: ru.tactics.options.wide },
              ],
            },
          ]).map((field) => (
            <TacticChoice
              key={field.key}
              label={field.label}
              value={club.tactic[field.key]}
              options={field.options}
              open={openTactic === field.key}
              onToggle={() => setOpenTactic(openTactic === field.key ? null : field.key)}
              onChange={(value) => {
                onChange({
                  ...game,
                  clubs: { ...game.clubs, [club.id]: { ...club, tactic: { ...club.tactic, [field.key]: value } as Tactics } },
                });
                setOpenTactic(null);
              }}
            />
          ))}
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
                    } else if (selected) {
                      setSelectedSlot(null);
                    } else {
                      setProfilePlayerId(player.id);
                    }
                  }}
                  title={player.name + ' · ' + slot.label}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setProfilePlayerId(player.id);
                  }}
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

      {profilePlayerId && game.players[profilePlayerId] && (
        <PlayerProfile
          player={game.players[profilePlayerId]}
          club={club}
          onClose={() => setProfilePlayerId(null)}
        />
      )}
    </section>
  );
}

function PlayerProfile({ player, club, onClose }: { player: Player; club: GameState['clubs'][string]; onClose: () => void }) {
  return (
    <div className="wsc-player-profile-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="wsc-player-profile" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
        <header>
          <div>
            <span>ИГРОК</span>
            <h2 id="player-profile-title">{player.name}</h2>
            <small>{club.name} · {positionLabel(player.position)} · {player.age} лет</small>
          </div>
          <button type="button" onClick={onClose} aria-label={ru.common.close}>×</button>
        </header>

        <div className="wsc-profile-grid">
          <div className="wsc-profile-overall">
            <small>ОБЩИЙ РЕЙТИНГ</small>
            <strong>{player.overall}</strong>
            <span>ПОТЕНЦИАЛ {player.potential}</span>
          </div>
          <div className="wsc-profile-lines">
            <div><span>Форма</span><strong>{player.form > 0 ? '+' : ''}{player.form}</strong></div>
            <div><span>Мораль</span><strong>{player.morale}</strong></div>
            <div><span>Фитнес</span><strong>{player.fitness}%</strong></div>
            <div><span>Матчи</span><strong>{player.appearances}</strong></div>
            <div><span>Голы</span><strong>{player.goals}</strong></div>
            <div><span>Ассисты</span><strong>{player.assists}</strong></div>
          </div>
        </div>

        <div className="wsc-profile-attributes">
          {[
            ['Скорость', player.attributes.pace],
            ['Удар', player.attributes.shooting],
            ['Пас', player.attributes.passing],
            ['Техника', player.attributes.technique],
            ['Дриблинг', player.attributes.dribbling],
            ['Защита', player.attributes.defending],
            ['Физика', player.attributes.physical],
            ['Выносливость', player.attributes.stamina],
          ].map(([label, value]) => (
            <div key={label as string}>
              <span>{label}</span>
              <div><i style={{ width: Math.max(5, Number(value)) + '%' }} /></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <footer>
          <span>{player.preferredFoot === 'L' ? 'Левая нога' : 'Правая нога'}</span>
          <span>{player.nationality ?? 'Без страны'}</span>
          <span>{formatMoney(player.value)}</span>
          <span>{formatMoney(player.wage)} / тур</span>
        </footer>
      </section>
    </div>
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
  const [view, setView] = useState<'table' | 'scorers' | 'assists'>('table');
  const rows = useMemo(() => [...game.table], [game.table]);
  const userRow = rows.find((row) => row.teamId === game.clubId);
  const userPosition = userRow ? rows.findIndex((row) => row.teamId === game.clubId) + 1 : 0;
  const userForm = useMemo(() => getClubForm(game, game.clubId), [game]);

  const leaders = useMemo(
    () => Object.values(game.players)
      .filter((player) => game.clubs[game.clubId]?.playerIds.includes(player.id) || player.appearances > 0)
      .sort((a, b) => (view === 'scorers' ? b.goals - a.goals : b.assists - a.assists) || b.overall - a.overall)
      .slice(0, 12),
    [game, view],
  );

  return (
    <section className="card content-card content-table">
      <div className="section-title-row table-page-header">
        <div>
          <h2>СОРЕВНОВАНИЕ</h2>
          <span className="wsc-screen-caption">Сезон {game.season} · Тур {Math.min(game.currentRound, 14)} / 14</span>
        </div>
        <div className="wsc-competition-tabs">
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>ТАБЛИЦА</button>
          <button type="button" className={view === 'scorers' ? 'active' : ''} onClick={() => setView('scorers')}>БОМБАРДИРЫ</button>
          <button type="button" className={view === 'assists' ? 'active' : ''} onClick={() => setView('assists')}>АССИСТЫ</button>
        </div>
      </div>

      {view === 'table' ? (
        <>
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
                  <th></th>
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
                      <td><span className={index === 0 ? 'table-rank top' : index < 4 ? 'table-rank upper' : 'table-rank'}>{index + 1}</span></td>
                      <td><div className="table-club-cell"><strong>{rowClub.name}</strong></div></td>
                      <td><TableForm results={form} /></td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.draws}</td>
                      <td>{row.losses}</td>
                      <td>{row.goalsFor}</td>
                      <td>{row.goalsAgainst}</td>
                      <td className={goalDifference > 0 ? 'goal-positive' : goalDifference < 0 ? 'goal-negative' : ''}>{goalDifference > 0 ? '+' : ''}{goalDifference}</td>
                      <td><strong>{row.points}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="wsc-leaders-screen">
          <div className="wsc-leaders-head">
            <div>
              <strong>{view === 'scorers' ? 'Лучшие бомбардиры' : 'Лучшие ассистенты'}</strong>
              <span>Игроки с наибольшим количеством результативных действий в текущей карьере</span>
            </div>
          </div>
          <div className="wsc-leaders-list">
            {leaders.length ? leaders.map((player, index) => {
              const stat = view === 'scorers' ? player.goals : player.assists;
              const playerClub = Object.values(game.clubs).find((club) => club.playerIds.includes(player.id));
              return (
                <div className="wsc-leader-row" key={player.id}>
                  <span className="wsc-leader-rank">{index + 1}</span>
                  <div className="wsc-leader-avatar">{player.name.slice(0, 1)}</div>
                  <div className="wsc-leader-player">
                    <strong>{player.name}</strong>
                    <span>{playerClub?.shortName ?? '—'} · {positionLabel(player.position)} · {player.age}</span>
                  </div>
                  <span className="wsc-leader-ovr">{player.overall}</span>
                  <strong className="wsc-leader-stat">{stat}</strong>
                </div>
              );
            }) : <div className="modal-empty">Статистика появится после сыгранных матчей.</div>}
          </div>
        </div>
      )}
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