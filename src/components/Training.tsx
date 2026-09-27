import { useMemo, useState } from 'react';
import type { GameState, PlayerAttributes } from '../domain/types';
import { applyTraining, getTrainingPreview, type TrainingFocus } from '../game/training';
import { ru } from '../i18n/ru';

const focusOrder: TrainingFocus[] = ['attack', 'passing', 'defense', 'physical'];

type TrainingChange = {
  name: string;
  ovrBefore: number;
  ovrAfter: number;
  changes: string[];
};

const attributeLabels: Record<keyof PlayerAttributes, string> = {
  pace: 'Скорость',
  shooting: 'Удар',
  passing: 'Пас',
  technique: 'Техника',
  dribbling: 'Дриблинг',
  defending: 'Защита',
  physical: 'Физика',
  stamina: 'Выносливость',
  positioning: 'Позиция',
  mentality: 'Менталитет',
  goalkeeper: 'Игра вратаря',
};

const positionLabels: Record<string, string> = {
  GK: ru.positions.gk,
  DEF: ru.positions.def,
  MID: ru.positions.mid,
  FWD: ru.positions.fwd,
};

function formatPositionList(positions: string[]): string {
  return positions.map((position) => positionLabels[position] ?? position).join(' · ');
}

function collectChanges(
  before: GameState['players'],
  after: GameState['players'],
  playerIds: string[],
): TrainingChange[] {
  const result: TrainingChange[] = [];

  for (const playerId of playerIds) {
    const previous = before[playerId];
    const current = after[playerId];
    if (!previous || !current) continue;

    const changes = (Object.keys(previous.attributes) as Array<keyof PlayerAttributes>)
      .filter((attribute) => current.attributes[attribute] > previous.attributes[attribute])
      .map((attribute) => attributeLabels[attribute] + ' ' + previous.attributes[attribute] + ' → ' + current.attributes[attribute]);

    if (changes.length || current.overall !== previous.overall) {
      result.push({
        name: current.name,
        ovrBefore: previous.overall,
        ovrAfter: current.overall,
        changes,
      });
    }
  }

  return result;
}

export function Training({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const [selectedFocus, setSelectedFocus] = useState<TrainingFocus>('physical');
  const [lastChanges, setLastChanges] = useState<TrainingChange[] | null>(null);
  const club = game.clubs[game.clubId];
  const roster = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  const used = Boolean(game.trainingUsed);
  const preview = useMemo(() => getTrainingPreview(game, selectedFocus), [game, selectedFocus]);

  const runTraining = () => {
    if (used) return;

    const beforePlayers = game.players;
    const nextGame = applyTraining(game, selectedFocus);
    if (nextGame === game) return;

    const changes = collectChanges(beforePlayers, nextGame.players, club.playerIds);
    setLastChanges(changes);
    onChange(nextGame);
  };

  const focusItem = ru.training.focus[selectedFocus];
  const bestFor = formatPositionList(preview.bestPositions);

  return (
    <section className="card content-card training-panel">
      <div className="section-title-row">
        <div>
          <h2>{ru.training.title}</h2>
          <p className="training-subtitle">{used ? ru.training.used : ru.training.available}</p>
        </div>
        <span className="training-round-badge">{ru.app.round} {game.currentRound}</span>
      </div>

      <div className="training-focus-grid">
        {focusOrder.map((focus) => {
          const item = ru.training.focus[focus];
          const selected = selectedFocus === focus;
          const focusPreview = getTrainingPreview(game, focus);
          return (
            <button
              key={focus}
              type="button"
              className={selected ? 'training-focus-card active' : 'training-focus-card'}
              onClick={() => setSelectedFocus(focus)}
              disabled={used}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              <small>{item.effect}</small>
              <em>{ru.training.bestFor}: {formatPositionList(focusPreview.bestPositions)}</em>
            </button>
          );
        })}
      </div>

      <div className="training-action-row">
        <div>
          <strong>{ru.training.selected}: {focusItem.title}</strong>
          <span>{ru.training.avgProgress}: +{preview.averageXp.toFixed(1)} {ru.training.xpUnit} · {ru.training.bestFor}: {bestFor}</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={runTraining}
          disabled={used}
        >
          {used ? ru.training.completed : ru.training.trainButton}
        </button>
      </div>

      {lastChanges && used && (
        <section className="training-result-card" aria-live="polite">
          <div className="training-result-header">
            <div>
              <span>{ru.training.resultTitle}</span>
              <strong>{focusItem.title}</strong>
            </div>
            <div className="training-result-summary">
              <b>{roster.length}</b> {ru.training.playersProgressed} · <b>{lastChanges.filter((change) => change.changes.length).length}</b> {ru.training.attributesImproved}
            </div>
          </div>
          <div className="training-result-changes">
            {lastChanges.slice(0, 6).map((change) => (
              <div key={change.name}>
                <strong>{change.name}</strong>
                <span>{change.changes.join(' · ') || ru.training.noUpgrade}</span>
                <b>{change.ovrAfter !== change.ovrBefore ? change.ovrBefore + ' → ' + change.ovrAfter : ru.training.maxed}</b>
              </div>
            ))}
          </div>
          <div className="training-result-footer">
            <span>{ru.training.fitnessChange}: −4</span>
            <span>{ru.training.moraleChange}: +1</span>
            <span>{ru.training.ovrImproved}: {lastChanges.filter((change) => change.ovrAfter !== change.ovrBefore).length}</span>
          </div>
        </section>
      )}

      <div className="training-roster">
        <div className="training-roster-header">
          <strong>{ru.training.squadTitle}</strong>
          <span>{ru.training.progressHint}</span>
        </div>
        <div className="training-player-list">
          {roster.map((player) => {
            const xp = Math.max(0, Math.min(99.99, player.developmentXp ?? 0));
            const progress = Math.min(100, xp);
            const maxed = player.overall >= player.potential;
            return (
              <article className="training-player-row" key={player.id}>
                <div className="training-player-main">
                  <strong>{player.name}</strong>
                  <span>{positionLabels[player.position] ?? player.position} · {player.age} {ru.transfers.age}</span>
                </div>
                <div className="training-player-rating">
                  <strong>{player.overall}</strong>
                  <small>{ru.training.ovr}</small>
                </div>
                <div className="training-player-potential">
                  <strong>{player.potential}</strong>
                  <small>{ru.training.potential}</small>
                </div>
                <div className="training-progress-wrap">
                  <div className="training-progress-track">
                    <span style={{ width: progress + '%' }} />
                  </div>
                  <small>{maxed ? ru.training.maxed : Math.floor(xp) + ' / 100 ' + ru.training.xpUnit}</small>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
