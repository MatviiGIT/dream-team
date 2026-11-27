import { useMemo, useState } from 'react';
import type { GameState, Player } from '../domain/types';
import { applyTraining, getTrainingPreview, trainingKey, type TrainingFocus } from '../game/training';

type TrainingReportRow = {
  id: string;
  name: string;
  position: string;
  ovrBefore: number;
  ovrAfter: number;
  skillName: string;
  skillBefore: number;
  skillAfter: number;
  xpBefore: number;
  xpAfter: number;
  fitnessBefore: number;
  fitnessAfter: number;
};

type FocusOption = {
  id: TrainingFocus;
  title: string;
  description: string;
  benefit: string;
  bestFor: string;
};

const FOCUSES: FocusOption[] = [
  { id: 'attack', title: 'ATTACK', description: 'Finishing, attacking movement and execution.', benefit: 'SHOOTING + TECHNIQUE', bestFor: 'FORWARDS & MIDFIELDERS' },
  { id: 'passing', title: 'PLAYMAKING', description: 'Passing quality, ball control and build-up play.', benefit: 'PASSING + TECHNIQUE', bestFor: 'MIDFIELDERS' },
  { id: 'defense', title: 'DEFENDING', description: 'Tackling, defensive positioning and goalkeeper work.', benefit: 'TACKLING / GOALKEEPING', bestFor: 'DEFENDERS & GOALKEEPERS' },
  { id: 'physical', title: 'PHYSICAL', description: 'Speed, strength and athletic development.', benefit: 'SPEED + PHYSICAL', bestFor: 'ALL POSITIONS' },
];

const POSITION_LABELS: Record<string, string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

function focusFor(value: TrainingFocus): FocusOption {
  return FOCUSES.find((focus) => focus.id === value)!;
}

type VisibleSkill = 'speed' | 'passing' | 'shooting' | 'tackling' | 'goalkeeping';

function skillFor(player: Player, focus: TrainingFocus): VisibleSkill {
  if (focus === 'attack') return 'shooting';
  if (focus === 'passing') return 'passing';
  if (focus === 'defense') return player.position === 'GK' ? 'goalkeeping' : 'tackling';
  return 'speed';
}

function skillLabel(skill: VisibleSkill): string {
  const labels: Record<VisibleSkill, string> = {
    speed: 'SPEED',
    passing: 'PASSING',
    shooting: 'SHOOTING',
    tackling: 'TACKLING',
    goalkeeping: 'GOALKEEPING',
  };
  return labels[skill];
}

function makeReport(before: GameState, after: GameState, focus: TrainingFocus): TrainingReportRow[] {
  const club = before.clubs[before.clubId];
  return club.playerIds.flatMap((id) => {
    const oldPlayer = before.players[id];
    const newPlayer = after.players[id];
    if (!oldPlayer || !newPlayer || oldPlayer === newPlayer) return [];
    const skill = skillFor(oldPlayer, focus);
    return [{
      id,
      name: newPlayer.name,
      position: newPlayer.position,
      ovrBefore: oldPlayer.overall,
      ovrAfter: newPlayer.overall,
      skillName: skillLabel(skill),
      skillBefore: oldPlayer.skills[skill],
      skillAfter: newPlayer.skills[skill],
      xpBefore: oldPlayer.developmentXp ?? 0,
      xpAfter: newPlayer.developmentXp ?? 0,
      fitnessBefore: oldPlayer.fitness,
      fitnessAfter: newPlayer.fitness,
    }];
  });
}

export function TrainingRoom({
  game,
  onHome,
  onChange,
}: {
  game: GameState;
  onHome: () => void;
  onChange: (next: GameState) => void;
}) {
  const [selected, setSelected] = useState<TrainingFocus>('physical');
  const [report, setReport] = useState<TrainingReportRow[] | null>(null);
  const club = game.clubs[game.clubId];
  const roster = club.playerIds.map((id) => game.players[id]).filter((player): player is Player => Boolean(player));
  const used = game.lastTrainingKey === trainingKey(game);
  const focus = focusFor(selected);
  const preview = useMemo(() => getTrainingPreview(game, selected), [game, selected]);

  const runTraining = () => {
    if (used) return;
    const next = applyTraining(game, selected);
    if (next === game) return;
    setReport(makeReport(game, next, selected));
    onChange(next);
  };

  const upgraded = report?.filter((row) => row.skillAfter > row.skillBefore) ?? [];
  const overallUpgrades = report?.filter((row) => row.ovrAfter > row.ovrBefore).length ?? 0;

  return (
    <section className="page training-room-page">
      <div className="page-head">
        <div>
          <button className="page-home-btn" onClick={onHome}>‹ MAIN</button>
          <div><span>PLAYER DEVELOPMENT · YEAR {game.season} · WEEK {game.week}</span><h2>TRAINING CENTRE</h2></div>
        </div>
        <div className={used ? 'training-status used' : 'training-status ready'}>{used ? 'SESSION COMPLETE' : 'SESSION AVAILABLE'}</div>
      </div>

      <div className="training-room-content">
        <div className="training-focus-area">
          <div className="training-section-heading">
            <div><span>CHOOSE YOUR SESSION</span><strong>TEAM TRAINING PLAN</strong></div>
            <small>ONE SESSION PER WEEK</small>
          </div>

          <div className="training-focus-options">
            {FOCUSES.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={used}
                className={selected === item.id ? 'training-focus-option active' : 'training-focus-option'}
                onClick={() => { setSelected(item.id); setReport(null); }}
              >
                <span className="training-focus-kicker">{item.benefit}</span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <small>BEST FOR · {item.bestFor}</small>
              </button>
            ))}
          </div>

          <div className="training-preview-strip">
            <div><span>PLAYERS IN SQUAD</span><strong>{preview.playerCount}</strong></div>
            <div><span>CAN STILL DEVELOP</span><strong>{preview.eligibleCount}</strong></div>
            <div><span>AVERAGE XP PER PLAYER</span><strong>+{preview.averageXp.toFixed(1)}</strong></div>
            <div><span>FITNESS COST</span><strong>−{preview.fitnessCost}</strong></div>
          </div>

          <div className="training-plan-summary">
            <div><span>SELECTED PLAN</span><strong>{focus.title}</strong><p>{focus.description} Best development efficiency: {preview.bestPositions.join(' / ')}.</p></div>
            <button className="training-run-btn" disabled={used || preview.eligibleCount === 0} onClick={runTraining}>
              {used ? 'COMPLETED THIS WEEK' : preview.eligibleCount === 0 ? 'SQUAD AT POTENTIAL' : 'START TRAINING ›'}
            </button>
          </div>
        </div>

        {report && (
          <section className="training-session-report">
            <header>
              <div><span>SESSION REPORT</span><strong>{focus.title} COMPLETED</strong></div>
              <div className="training-report-summary">
                <b>{report.length}</b><span>players developed</span>
                <b>{upgraded.length}</b><span>skill increases</span>
                <b>{overallUpgrades}</b><span>OVR increases</span>
              </div>
            </header>
            {report.length ? (
              <div className="training-report-list">
                {report.filter((row) => row.skillAfter > row.skillBefore || row.ovrAfter > row.ovrBefore).slice(0, 5).map((row) => (
                  <div key={row.id}>
                    <strong>{row.name}</strong>
                    <span>{row.position} · {row.skillName} {row.skillBefore} → {row.skillAfter}</span>
                    <b>{row.ovrBefore === row.ovrAfter ? 'OVR ' + row.ovrAfter : 'OVR ' + row.ovrBefore + ' → ' + row.ovrAfter}</b>
                  </div>
                ))}
                {!upgraded.length && <p>Players gained development XP. Skill increases will appear as their progress reaches 100 XP.</p>}
              </div>
            ) : (
              <p className="training-no-growth">The squad has reached its current potential. Focus on fitness and match preparation.</p>
            )}
            <div className="training-report-condition">
              <span>CONDITION IMPACT</span>
              <b>FITNESS −{focus.id === 'physical' ? 4 : 2} per developing player</b>
              <b>MORALE +1</b>
            </div>
          </section>
        )}

        <div className="training-roster-heading">
          <div><span>PLAYER DEVELOPMENT</span><strong>SQUAD PROGRESS</strong></div>
          <small>100 XP = ONE SKILL INCREASE</small>
        </div>

        <div className="training-roster-list">
          {roster.map((player) => {
            const xp = Math.max(0, Math.min(99.99, player.developmentXp ?? 0));
            const maxed = player.overall >= player.potential;
            const progress = maxed ? 100 : xp;
            return (
              <article className={maxed ? 'training-roster-player maxed' : 'training-roster-player'} key={player.id}>
                <div className="training-roster-identity">
                  <strong>{player.name}</strong>
                  <span>{POSITION_LABELS[player.position]} · {player.age} YRS · {Math.round(player.fitness)}% FITNESS</span>
                </div>
                <div className="training-roster-ovr"><strong>{player.overall}</strong><small>OVR</small></div>
                <div className="training-roster-pot"><strong>{player.potential}</strong><small>POT</small></div>
                <div className="training-roster-progress">
                  <div><span style={{ width: progress + '%' }}/></div>
                  <small>{maxed ? 'POTENTIAL REACHED' : Math.floor(xp) + ' / 100 XP'}</small>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
