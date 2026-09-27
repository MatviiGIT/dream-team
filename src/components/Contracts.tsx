import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import type { ContractRole, GameState, Player } from '../domain/types';
import { getRenewalOffer, getSquadRole, renewContract, type ContractError, } from '../game/contracts';
import { setTransferListing, type TransferError } from '../game/transfers';
import { ru } from '../i18n/ru';
import '../styles/contracts.css';

function formatMoney(value: number): string {
  if (value >= 1_000_000) return '€' + (value / 1_000_000).toFixed(1) + ' млн';
  return '€' + Math.round(value / 1000) + ' тыс.';
}

function roleLabel(role: ContractRole): string {
  return ru.contracts.roles[role];
}

function contractErrorText(error: ContractError | TransferError): string {
  switch (error) {
    case 'not-enough-budget': return ru.contracts.errors.notEnoughBudget;
    case 'cannot-list-starter': return ru.contracts.errors.cannotListStarter;
    case 'not-owned': return ru.contracts.errors.notOwned;
    default: return ru.contracts.errors.notFound;
  }
}

function RenewalModal({
  game,
  player,
  onClose,
  onChange,
}: {
  game: GameState;
  player: Player;
  onClose: () => void;
  onChange: (nextGame: GameState) => void;
}) {
  const offers = [2, 3, 4]
    .map((years) => getRenewalOffer(game, player.id, years))
    .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));

  const [selectedYears, setSelectedYears] = useState(offers[0]?.years ?? 2);
  const selectedOffer = offers.find((offer) => offer.years === selectedYears) ?? offers[0];

  if (!selectedOffer) return null;

  const confirmRenewal = () => {
    const result = renewContract(game, player.id, selectedYears);
    if (result.error) return;
    onChange(result.state);
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop contract-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-window contract-renew-modal" role="dialog" aria-modal="true" aria-labelledby="contract-renew-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">{ru.contracts.renewEyebrow}</div>
            <h2 id="contract-renew-title">{player.name}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label={ru.common.close}>×</button>
        </div>

        <div className="contract-renew-player">
          <div className="transfer-player-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{player.nationality ?? ru.transfers.unknownNationality}</strong>
            <span>{ru.contracts.currentWage}: {formatMoney(player.wage)} · {ru.contracts.currentYears}: {player.contract?.yearsRemaining ?? 1}</span>
          </div>
        </div>

        <div className="renewal-options">
          {offers.map((offer) => (
            <button
              key={offer.years}
              type="button"
              className={offer.years === selectedYears ? 'renewal-option active' : 'renewal-option'}
              onClick={() => setSelectedYears(offer.years)}
            >
              <strong>{offer.years} {ru.contracts.years}</strong>
              <span>{formatMoney(offer.newWage)} / {ru.transfers.roundShort}</span>
              <small>{ru.contracts.signingBonus}: {formatMoney(offer.signingBonus)}</small>
            </button>
          ))}
        </div>

        <div className="contract-offer-summary">
          <div><span>{ru.contracts.newWage}</span><strong>{formatMoney(selectedOffer.newWage)}</strong></div>
          <div><span>{ru.contracts.signingBonus}</span><strong>{formatMoney(selectedOffer.signingBonus)}</strong></div>
          <div><span>{ru.contracts.budgetAfter}</span><strong className={selectedOffer.budgetAfter >= 0 ? 'positive' : 'negative'}>{formatMoney(Math.max(0, selectedOffer.budgetAfter))}</strong></div>
        </div>

        <button className="primary-button full" type="button" disabled={selectedOffer.budgetAfter < 0} onClick={confirmRenewal}>
          {selectedOffer.budgetAfter < 0 ? ru.contracts.notEnoughBudget : ru.contracts.confirmRenew}
        </button>
      </section>
    </div>,
    document.body,
  );
}

export function Contracts({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const club = game.clubs[game.clubId];
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContractRole | 'ALL'>('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [renewalPlayerId, setRenewalPlayerId] = useState<string | null>(null);

  const players = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return club.playerIds
      .map((id) => game.players[id])
      .filter((player): player is Player => Boolean(player))
      .filter((player) => {
        const role = getSquadRole(game, player.id);
        return (!query || player.name.toLocaleLowerCase('ru-RU').includes(query)) &&
          (roleFilter === 'ALL' || role === roleFilter);
      })
      .sort((a, b) => {
        const aRole = getSquadRole(game, a.id);
        const bRole = getSquadRole(game, b.id);
        const order: Record<ContractRole, number> = { starter: 0, rotation: 1, prospect: 2, reserve: 3 };
        return order[aRole] - order[bRole] || a.overall - b.overall;
      });
  }, [club.playerIds, game, roleFilter, search]);

  const expiring = club.playerIds
    .map((id) => game.players[id])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => (player.contract?.yearsRemaining ?? 1) <= 1).length;

  const listedCount = club.playerIds
    .map((id) => game.players[id])
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.transferListed).length;

  const actionNotice = (type: 'success' | 'error', text: string) => setNotice({ type, text });

  const toggleListing = (player: Player) => {
    const result = setTransferListing(game, player.id, !player.transferListed);
    if (result.error) {
      actionNotice('error', contractErrorText(result.error));
      return;
    }
    onChange(result.state);
    actionNotice('success', player.transferListed ? ru.contracts.removedFromMarket : ru.contracts.addedToMarket);
  };

  return (
    <section className="card content-card contracts-panel">
      <div className="contracts-header">
        <div>
          <h2>{ru.contracts.title}</h2>
        </div>
        <div className="contracts-budget">
          <div><span>{ru.transfers.budget}</span><strong>{formatMoney(club.budget)}</strong></div>
          <div><span>{ru.transfers.wages}</span><strong>{formatMoney(club.wages)}</strong></div>
        </div>
      </div>

      <div className="contract-summary-grid">
        <div><span>{ru.contracts.players}</span><strong>{club.playerIds.length}</strong></div>
        <div><span>{ru.contracts.expiring}</span><strong>{expiring}</strong></div>
        <div><span>{ru.contracts.listed}</span><strong>{listedCount}</strong></div>
        <div><span>{ru.contracts.wageRoom}</span><strong>{formatMoney(Math.max(0, club.budget))}</strong></div>
      </div>

      <div className="contract-toolbar">
        <label className="transfer-search">
          <input aria-label={ru.contracts.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ru.contracts.searchPlaceholder} type="search" />
        </label>
        <div className="contract-role-filters">
          {[
            ['ALL', ru.contracts.allRoles],
            ['starter', ru.contracts.roles.starter],
            ['rotation', ru.contracts.roles.rotation],
            ['prospect', ru.contracts.roles.prospect],
            ['reserve', ru.contracts.roles.reserve],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={roleFilter === value ? 'contract-role-filter active' : 'contract-role-filter'}
              onClick={() => setRoleFilter(value as ContractRole | 'ALL')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="contract-list">
        {players.map((player) => {
          const role = getSquadRole(game, player.id);
          const years = player.contract?.yearsRemaining ?? 1;
          const expiringSoon = years <= 1;
          return (
            <article className={expiringSoon ? 'contract-player-row expiring' : 'contract-player-row'} key={player.id}>
              <div className="contract-player-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
              <div className="contract-player-main">
                <div className="contract-player-name">
                  <strong>{player.name}</strong>
                  {player.transferListed && <span>{ru.contracts.onMarket}</span>}
                </div>
                <span>{player.nationality ?? ru.transfers.unknownNationality} · {ru.positions[player.position === 'GK' ? 'gk' : player.position === 'DEF' ? 'def' : player.position === 'MID' ? 'mid' : 'fwd']}</span>
              </div>
              <div className="contract-metric"><small>OVR</small><strong>{player.overall}</strong></div>
              <div className="contract-metric"><small>{ru.contracts.role}</small><strong>{roleLabel(role)}</strong></div>
              <div className="contract-metric"><small>{ru.contracts.term}</small><strong className={expiringSoon ? 'warning' : ''}>{years} {ru.contracts.years}</strong></div>
              <div className="contract-metric"><small>{ru.contracts.wage}</small><strong>{formatMoney(player.wage)}</strong></div>
              <div className="contract-actions">
                <button type="button" className="secondary-button" onClick={() => setRenewalPlayerId(player.id)}>
                  {ru.contracts.renew}
                </button>
                <button type="button" className={player.transferListed ? 'ghost-button listed' : 'ghost-button'} onClick={() => toggleListing(player)}>
                  {player.transferListed ? ru.contracts.removeMarket : ru.contracts.listMarket}
                </button>
              </div>
            </article>
          );
        })}

        {!players.length && (
          <div className="contract-empty">
            <strong>{ru.contracts.noPlayers}</strong>
            <span>{ru.contracts.noPlayersHint}</span>
          </div>
        )}
      </div>

      {notice && (
        <div className={'transfer-notice ' + notice.type} role="status">
          <span>{notice.type === 'success' ? '✓' : '!'}</span>
          <strong>{notice.text}</strong>
          <button type="button" onClick={() => setNotice(null)} aria-label={ru.common.close}>×</button>
        </div>
      )}

      {renewalPlayerId && game.players[renewalPlayerId] && (
        <RenewalModal
          game={game}
          player={game.players[renewalPlayerId]}
          onClose={() => setRenewalPlayerId(null)}
          onChange={onChange}
        />
      )}
    </section>
  );
}
