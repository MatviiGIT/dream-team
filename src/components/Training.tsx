import { useState } from 'react';
import type { GameState } from '../domain/types';
import { applyTraining, type TrainingFocus } from '../game/training';
import { ru } from '../i18n/ru';

const focusOrder: TrainingFocus[] = ['attack', 'passing', 'defense', 'physical'];

function trainingDescription(focus: TrainingFocus): string {
  return ru.training.focus[focus].description;
}

export function Training({ game, onChange }: { game: GameState; onChange: (nextGame: GameState) => void }) {
  const [selectedFocus, setSelectedFocus] = useState<TrainingFocus>('physical');
  const club = game.clubs[game.clubId];
  const roster = club.playerIds.map((id) => game.players[id]).filter(Boolean);
  const used = Boolean(game.trainingUsed);

  const runTraining = () => {
    const nextGame = applyTraining(game, selectedFocus);
    if (nextGame !== game) onChange(nextGame);
  };

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
          return (
            <button
              key={focus}
              type="button"
              className={selected ? 'training-focus-card active' : 'training-focus-card'}
              onClick={() => setSelectedFocus(focus)}
            >
              <strong>{item.title}</strong>
              <span>{trainingDescription(focus)}</span>
              <small>{item.effect}</small>
            </button>
          );
        })}
      </div>

      <div className="training-action-row">
        <div>
          <strong>{ru.training.selected}: {ru.training.focus[selectedFocus].title}</strong>
          <span>{ru.training.sessionHint}</span>
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

      <div className="training-roster">
        <div className="training-roster-header">
          <strong>{ru.training.squadTitle}</strong>
          <span>{ru.training.progressHint}</span>
        </div>
        <div className="training-player-list">
          {roster.map((player) => {
            const xp = Math.max(0, Math.min(99.99, player.developmentXp ?? 0));
            const progress = Math.min(100, xp);
            return (
              <article className="training-player-row" key={player.id}>
                <div className="training-player-main">
                  <strong>{player.name}</strong>
                  <span>{player.position} · {player.age} {ru.transfers.age}</span>
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
                  <small>{Math.floor(xp)}%</small>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
