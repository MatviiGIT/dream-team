import { useMemo, useState } from 'react';
import type { ContractRole, GameState, Position } from '../domain/types';
import { buyPlayer, getTransferMarket, type TransferError } from '../game/transfers';
import { ru } from '../i18n/ru';
import '../styles/transfers.css';

type MarketFilters = {
  position: Position | 'ALL';
  nationality: string;
  clubId: string;
  role: ContractRole | 'ALL';
  minAge: string;
  maxAge: string;
  minOverall: string;
  maxOverall: string;
  minPotential: string;
  maxPotential: string;
  foot: 'ALL' | 'L' | 'R';
};

const defaultFilters: MarketFilters = {
  position: 'ALL',
  nationality: 'ALL',
  clubId: 'ALL',
  role: 'ALL',
  minAge: '',
  maxAge: '',
  minOverall: '',
  maxOverall: '',
  minPotential: '',
  maxPotential: '',
  foot: 'ALL',
};

function formatMoney(value: number): string {
  if (value >= 1_000_000) return '€' + (value / 1_000_000).toFixed(1) + ' млн';
  return '€' + Math.round(value / 1000) + ' тыс.';
}

function positionLabel(position: Position): string {
  return ({ GK: ru.positions.gk, DEF: ru.positions.def, MID: ru.positions.mid, FWD: ru.positions.fwd })[position];
}

function roleLabel(role: ContractRole): string {
  return ru.contracts.roles[role];
}

function errorText(error: TransferError): string {
  switch (error) {
    case 'not-enough-budget': return ru.transfers.errors.notEnoughBudget;
    case 'seller-too-small': return ru.transfers.errors.notOnMarket;
    case 'not-owned': return ru.transfers.errors.notOwned;
    case 'cannot-list-starter': return ru.transfers.errors.cannotListStarter;
    default: return ru.transfers.errors.notFound;
  }
}

function numberValue(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' ? parsed : undefined;
}

export function TransferMarket({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const club = game.clubs[game.clubId];
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MarketFilters>(defaultFilters);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const nationalities = useMemo(
    () => Array.from(new Set(getTransferMarket(game).map(({ player }) => player.nationality).filter(Boolean))).sort(),
    [game],
  );

  const marketClubs = useMemo(
    () => Object.values(game.clubs)
      .filter((otherClub) => otherClub.id !== club.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [club.id, game.clubs],
  );

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'position' || key === 'role' || key === 'clubId' || key === 'nationality' || key === 'foot') return value !== 'ALL';
    return value !== '';
  }).length;

  const market = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    const minAge = numberValue(filters.minAge);
    const maxAge = numberValue(filters.maxAge);
    const minOverall = numberValue(filters.minOverall);
    const maxOverall = numberValue(filters.maxOverall);
    const minPotential = numberValue(filters.minPotential);
    const maxPotential = numberValue(filters.maxPotential);

    return getTransferMarket(game).filter(({ player, seller }) => {
      const role = player.contract?.role ?? 'reserve';
      const matchesSearch = !query || player.name.toLocaleLowerCase('ru-RU').includes(query);
      const matchesPosition = filters.position === 'ALL' || player.position === filters.position;
      const matchesNationality = filters.nationality === 'ALL' || player.nationality === filters.nationality;
      const matchesClub = filters.clubId === 'ALL' || seller.id === filters.clubId;
      const matchesRole = filters.role === 'ALL' || role === filters.role;
      const matchesAge = (minAge === undefined || player.age >= minAge) && (maxAge === undefined || player.age <= maxAge);
      const matchesOverall = (minOverall === undefined || player.overall >= minOverall) && (maxOverall === undefined || player.overall <= maxOverall);
      const matchesPotential = (minPotential === undefined || player.potential >= minPotential) && (maxPotential === undefined || player.potential <= maxPotential);
      const matchesFoot = filters.foot === 'ALL' || player.preferredFoot === filters.foot;
      return matchesSearch && matchesPosition && matchesNationality && matchesClub && matchesRole &&
        matchesAge && matchesOverall && matchesPotential && matchesFoot;
    });
  }, [filters, game, search]);

  const runPurchase = (playerId: string, playerName: string) => {
    const result = buyPlayer(game, playerId);
    if (result.error) {
      setNotice({ type: 'error', text: errorText(result.error) });
      return;
    }
    onChange(result.state);
    setNotice({
      type: 'success',
      text: playerName + ' · ' + ru.transfers.purchasedFor + ' ' + formatMoney(result.price ?? 0),
    });
  };

  const updateFilter = <K extends keyof MarketFilters>(key: K, value: MarketFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="card content-card transfers-panel">
      <div className="transfers-header">
        <div>
          <div className="eyebrow">{ru.transfers.eyebrow}</div>
          <h2>{ru.transfers.title}</h2>
          <p>{ru.transfers.subtitle}</p>
        </div>
        <div className="transfers-budget">
          <span>{ru.transfers.budget}</span>
          <strong>{formatMoney(club.budget)}</strong>
          <small>{ru.transfers.wages}: {formatMoney(club.wages)} · {club.playerIds.length} {ru.transfers.players}</small>
        </div>
      </div>

      <div className="transfer-toolbar">
        <label className="transfer-search">
          <span>{ru.transfers.search}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ru.transfers.searchPlaceholder}
            type="search"
          />
        </label>
        <button
          type="button"
          className={filtersOpen ? 'transfer-filter-trigger open' : 'transfer-filter-trigger'}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          <span>⚙</span>
          {ru.transfers.filters}
          {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
        </button>
      </div>

      {filtersOpen && (
        <div className="transfer-filter-panel">
          <div className="transfer-filter-panel-head">
            <div>
              <div className="eyebrow">{ru.transfers.filtersEyebrow}</div>
              <strong>{ru.transfers.filtersTitle}</strong>
            </div>
            <button type="button" className="ghost-button transfer-filter-reset" onClick={() => setFilters(defaultFilters)}>
              {ru.transfers.resetFilters}
            </button>
          </div>

          <div className="transfer-filter-groups">
            <div className="transfer-filter-group">
              <span>{ru.transfers.filterPosition}</span>
              <div className="transfer-filter-chips">
                {[
                  ['ALL', ru.transfers.all],
                  ['GK', ru.positions.gk],
                  ['DEF', ru.positions.def],
                  ['MID', ru.positions.mid],
                  ['FWD', ru.positions.fwd],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={filters.position === value ? 'transfer-filter-chip active' : 'transfer-filter-chip'}
                    onClick={() => updateFilter('position', value as MarketFilters['position'])}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="transfer-filter-field">
              <span>{ru.transfers.filterClub}</span>
              <select value={filters.clubId} onChange={(event) => updateFilter('clubId', event.target.value)}>
                <option value="ALL">{ru.transfers.allClubs}</option>
                {marketClubs.map((otherClub) => <option key={otherClub.id} value={otherClub.id}>{otherClub.name}</option>)}
              </select>
            </label>

            <label className="transfer-filter-field">
              <span>{ru.transfers.filterNationality}</span>
              <select value={filters.nationality} onChange={(event) => updateFilter('nationality', event.target.value)}>
                <option value="ALL">{ru.transfers.allNationalities}</option>
                {nationalities.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
              </select>
            </label>

            <label className="transfer-filter-field">
              <span>{ru.transfers.filterRole}</span>
              <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value as MarketFilters['role'])}>
                <option value="ALL">{ru.transfers.allRoles}</option>
                <option value="starter">{ru.contracts.roles.starter}</option>
                <option value="rotation">{ru.contracts.roles.rotation}</option>
                <option value="prospect">{ru.contracts.roles.prospect}</option>
                <option value="reserve">{ru.contracts.roles.reserve}</option>
              </select>
            </label>

            <div className="transfer-filter-range">
              <span>{ru.transfers.filterAge}</span>
              <div>
                <input inputMode="numeric" value={filters.minAge} onChange={(event) => updateFilter('minAge', event.target.value)} placeholder={ru.transfers.from} aria-label={ru.transfers.from} />
                <span>–</span>
                <input inputMode="numeric" value={filters.maxAge} onChange={(event) => updateFilter('maxAge', event.target.value)} placeholder={ru.transfers.to} aria-label={ru.transfers.to} />
              </div>
            </div>

            <div className="transfer-filter-range">
              <span>{ru.transfers.filterOverall}</span>
              <div>
                <input inputMode="numeric" value={filters.minOverall} onChange={(event) => updateFilter('minOverall', event.target.value)} placeholder={ru.transfers.from} aria-label={ru.transfers.from} />
                <span>–</span>
                <input inputMode="numeric" value={filters.maxOverall} onChange={(event) => updateFilter('maxOverall', event.target.value)} placeholder={ru.transfers.to} aria-label={ru.transfers.to} />
              </div>
            </div>

            <div className="transfer-filter-range">
              <span>{ru.transfers.filterPotential}</span>
              <div>
                <input inputMode="numeric" value={filters.minPotential} onChange={(event) => updateFilter('minPotential', event.target.value)} placeholder={ru.transfers.from} aria-label={ru.transfers.from} />
                <span>–</span>
                <input inputMode="numeric" value={filters.maxPotential} onChange={(event) => updateFilter('maxPotential', event.target.value)} placeholder={ru.transfers.to} aria-label={ru.transfers.to} />
              </div>
            </div>

            <div className="transfer-filter-group">
              <span>{ru.transfers.filterFoot}</span>
              <div className="transfer-filter-chips">
                {[
                  ['ALL', ru.transfers.all],
                  ['L', ru.squad.leftFoot],
                  ['R', ru.squad.rightFoot],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={filters.foot === value ? 'transfer-filter-chip active' : 'transfer-filter-chip'}
                    onClick={() => updateFilter('foot', value as MarketFilters['foot'])}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="transfer-market-meta">
        <div>
          <strong>{market.length}</strong>
          <span>{ru.transfers.availablePlayers}</span>
        </div>
        <span className="transfer-market-meta-note">{ru.transfers.marketRule}</span>
      </div>

      <div className="transfer-market-list">
        {market.map(({ player, seller, price }) => {
          const role = player.contract?.role ?? 'reserve';
          return (
            <article className="transfer-player-card" key={player.id}>
              <div className="transfer-player-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
              <div className="transfer-player-main">
                <div className="transfer-player-name-line">
                  <strong>{player.name}</strong>
                  <span className="transfer-market-badge">{ru.transfers.onMarket}</span>
                </div>
                <span>{seller.shortName} · {positionLabel(player.position)} · {player.age} {ru.transfers.age} · {player.nationality ?? ru.transfers.unknownNationality}</span>
              </div>
              <div className="transfer-player-role">
                <small>{ru.transfers.role}</small>
                <strong>{roleLabel(role)}</strong>
              </div>
              <div className="transfer-player-stat">
                <small>OVR</small>
                <strong>{player.overall}</strong>
              </div>
              <div className="transfer-player-stat">
                <small>{ru.transfers.potential}</small>
                <strong>{player.potential}</strong>
              </div>
              <div className="transfer-player-finance">
                <strong>{formatMoney(price)}</strong>
                <span>{ru.transfers.wage}: {formatMoney(player.wage)} / {ru.transfers.roundShort}</span>
              </div>
              <button
                type="button"
                className="primary-button transfer-buy-button"
                onClick={() => runPurchase(player.id, player.name)}
              >
                {ru.transfers.buy}
              </button>
            </article>
          );
        })}

        {!market.length && (
          <div className="transfer-empty">
            <strong>{ru.transfers.noPlayers}</strong>
            <span>{ru.transfers.noPlayersHint}</span>
          </div>
        )}
      </div>

      <div className="transfer-footer-note">
        <span>ⓘ</span>
        <div>
          <strong>{ru.transfers.noOwnPlayers}</strong>
          <span>{ru.transfers.noOwnPlayersHint}</span>
        </div>
      </div>

      {notice && (
        <div className={'transfer-notice ' + notice.type} role="status">
          <span>{notice.type === 'success' ? '✓' : '!'}</span>
          <strong>{notice.text}</strong>
          <button type="button" onClick={() => setNotice(null)} aria-label={ru.common.close}>×</button>
        </div>
      )}
    </section>
  );
}
