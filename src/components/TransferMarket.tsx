import { useMemo, useState } from 'react';
import type { GameState, Position } from '../domain/types';
import { buyPlayer, getSalePrice, getTransferMarket, sellPlayer, type TransferError } from '../game/transfers';
import { ru } from '../i18n/ru';
import '../styles/transfers.css';

const FILTERS: Array<{ value: Position | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'GK', label: ru.positions.gk },
  { value: 'DEF', label: ru.positions.def },
  { value: 'MID', label: ru.positions.mid },
  { value: 'FWD', label: ru.positions.fwd },
];

function formatMoney(value: number): string {
  if (value >= 1_000_000) return '€' + (value / 1_000_000).toFixed(1) + ' млн';
  return '€' + Math.round(value / 1000) + ' тыс.';
}

function positionLabel(position: Position): string {
  return ({
    GK: ru.positions.gk,
    DEF: ru.positions.def,
    MID: ru.positions.mid,
    FWD: ru.positions.fwd,
  })[position];
}

function errorText(error: TransferError): string {
  switch (error) {
    case 'not-enough-budget': return ru.transfers.errors.notEnoughBudget;
    case 'seller-too-small': return ru.transfers.errors.sellerTooSmall;
    case 'not-owned': return ru.transfers.errors.notOwned;
    case 'cannot-sell-starter': return ru.transfers.errors.cannotSellStarter;
    case 'squad-too-small': return ru.transfers.errors.squadTooSmall;
    default: return ru.transfers.errors.notFound;
  }
}

export function TransferMarket({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const club = game.clubs[game.clubId];
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const market = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return getTransferMarket(game).filter(({ player }) => {
      const matchesSearch = !query || player.name.toLocaleLowerCase('ru-RU').includes(query);
      const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter;
      return matchesSearch && matchesPosition;
    });
  }, [game, positionFilter, search]);

  const saleList = useMemo(() => {
    const starters = new Set(club.startingXI ?? []);
    return club.playerIds
      .map((id) => game.players[id])
      .filter((player): player is NonNullable<typeof player> => Boolean(player) && !starters.has(player.id))
      .sort((a, b) => b.overall - a.overall);
  }, [club.playerIds, club.startingXI, game.players]);

  const runAction = (
    result: ReturnType<typeof buyPlayer>,
    successText: (price: number) => string,
  ) => {
    if (result.error) {
      setNotice({ type: 'error', text: errorText(result.error) });
      return;
    }
    onChange(result.state);
    setNotice({ type: 'success', text: successText(result.price ?? 0) });
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
          <small>{ru.transfers.wages}: {formatMoney(club.wages)}</small>
        </div>
      </div>

      <div className="transfers-layout">
        <div className="transfer-market-column">
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
            <div className="transfer-filters" aria-label={ru.transfers.positionFilter}>
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={positionFilter === filter.value ? 'transfer-filter active' : 'transfer-filter'}
                  onClick={() => setPositionFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="transfer-market-meta">
            <strong>{market.length}</strong>
            <span>{ru.transfers.availablePlayers}</span>
          </div>

          <div className="transfer-market-list">
            {market.map(({ player, seller, price }) => {
              const canAfford = club.budget >= price;
              return (
                <article className="transfer-player-card" key={player.id}>
                  <div className="transfer-player-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
                  <div className="transfer-player-main">
                    <strong>{player.name}</strong>
                    <span>{seller.shortName} · {positionLabel(player.position)} · {player.age} {ru.transfers.age}</span>
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
                    disabled={!canAfford}
                    onClick={() => runAction(
                      buyPlayer(game, player.id),
                      (paid) => player.name + ' · ' + ru.transfers.purchasedFor + ' ' + formatMoney(paid),
                    )}
                  >
                    {canAfford ? ru.transfers.buy : ru.transfers.notEnough}
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
        </div>

        <aside className="transfer-sale-panel">
          <div className="eyebrow">{ru.transfers.yourPlayers}</div>
          <h3>{ru.transfers.sellTitle}</h3>
          <p>{ru.transfers.sellHint}</p>
          <div className="transfer-sale-list">
            {saleList.map((player) => (
              <div className="transfer-sale-row" key={player.id}>
                <div className="transfer-sale-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
                <div className="transfer-sale-main">
                  <strong>{player.name}</strong>
                  <span>{positionLabel(player.position)} · OVR {player.overall}</span>
                </div>
                <div className="transfer-sale-value">
                  <strong>{formatMoney(getSalePrice(player))}</strong>
                  <small>{ru.transfers.wage}: {formatMoney(player.wage)}</small>
                </div>
                <button
                  type="button"
                  className="secondary-button transfer-sell-button"
                  onClick={() => {
                    const result = sellPlayer(game, player.id);
                    runAction(
                      result,
                      (received) => player.name + ' · ' + ru.transfers.soldFor + ' ' + formatMoney(received),
                    );
                  }}
                >
                  {ru.transfers.sell}
                </button>
              </div>
            ))}
            {!saleList.length && <div className="transfer-empty compact">{ru.transfers.noSaleCandidates}</div>}
          </div>
          <div className="transfer-note">
            <strong>{ru.transfers.squadRuleTitle}</strong>
            <span>{ru.transfers.squadRule}</span>
          </div>
        </aside>
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
