# Dream Team — Recovery Snapshot

> Persistent context file for restoring the project direction if the surrounding chat context is lost.
> This file intentionally contains project information only and must not contain the user's personal name or other personal data.

## Project identity

- Name: **Dream Team**
- Type: browser-based football management and automatic match-simulation game
- Stack: React + TypeScript + Vite
- Development UI language: Russian
- Future languages: add through the localization layer; do not hard-code user-facing text outside localization where practical
- Repository: `MatviiGIT/dream-team`
- Default branch: `main`

## Product direction

The game is inspired by the general idea of lightweight football-management simulators, but the implementation, UI, wording, game data and code are original.

Core loop:
1. Create or open a manager career.
2. Choose a fictional club.
3. Review squad, tactics, table and upcoming match.
4. Simulate the next match automatically.
5. Update table, form and match history.
6. Continue through multiple rounds and seasons.

The manager does **not** directly control players during matches. Matches are simulated by the game engine.

## Current implemented features

- Automatic deterministic/seeded match simulation.
- Fictional clubs and players.
- League fixtures and table.
- Squad screen.
- Tactics screen.
- Match events and latest-match statistics.
- Multiple independent career saves in browser localStorage.
- Mandatory manager-name field when creating a career.
- Career delete/continue flow.
- Local persistence with save-version migration.
- Russian localization layer.
- Responsive dashboard.
- Application viewport is fixed to the browser window; the main game screen does not globally scroll. Long lists/tables/events scroll inside their own panels.
- CI workflow for typecheck/build.

## Architecture

Key files:

- `src/App.tsx`
  - Main application flow and screens.
  - Career start/open/delete.
  - Tabs: overview, squad, tactics, table.
  - Match simulation trigger.
- `src/domain/types.ts`
  - GameState, Player, Club, MatchResult, Fixture, TableRow, Tactics and related types.
- `src/game/career.ts`
  - Career creation.
  - Fixture generation.
  - League table updates.
  - Next-round simulation.
- `src/simulation/matchSimulator.ts`
  - Automatic match simulation engine.
- `src/simulation/rng.ts`
  - Seeded random number generator.
- `src/data/initialWorld.ts`
  - Initial fictional world, clubs and players.
- `src/storage/gameStorage.ts`
  - Multiple-career localStorage persistence.
  - Current key: `dream-team:careers:v2`.
  - Legacy migration key: `dream-team:career:v1`.
- `src/i18n/ru.ts`
  - Russian UI text.
- `src/i18n/index.ts`
  - Localization registry and default locale.
- `src/styles.css`
  - Global visual system, dashboard layout, responsive behavior and viewport handling.
- `index.html`
  - Russian document language and page metadata.

## Save model

Current game state uses:

- `saveVersion: 2`
- `careerId`
- `managerName`
- `clubId`
- `season`
- `currentRound`
- `clubs`
- `players`
- `fixtures`
- `table`
- optional `lastMatch`
- `createdAt`
- `updatedAt`

Multiple careers are stored as an array under `dream-team:careers:v2`.

## UI/UX rules

These are intentional design requirements for future changes:

### Visual hierarchy
- Avoid the previous overly monochromatic blue/purple look.
- Use a neutral dark base with semantic accents:
  - mint/green for primary actions and positive state
  - blue for secondary information
  - gold for financial/warning information
  - red/pink for destructive/error information
  - club colors for club identity
- Cards should have clear hierarchy and noticeably different semantic color treatments so sections are visually distinct.
- Use larger readable text; avoid excessive 8–10px labels.
- Important numbers and actions should be visually prominent.

### Layout
- Browser viewport itself should remain fixed.
- The app should occupy the full viewport height.
- On the main game screen, the top bar and application viewport stay fixed. Long content is contained inside its own panel; the page itself must not move vertically.
- On the start screen, the whole page stays fixed. The saved-career area has its own internal scroll when many saves exist.
- Menus, cards and grids must have balanced proportions rather than many tiny dense elements.
- Responsive behavior must remain usable on desktop and narrow mobile widths.

### Interaction
- Buttons must have visible hover/focus states.
- Destructive actions must require confirmation.
- Form validation should be explicit.
- Avoid introducing personal/default manager names into the UI; placeholders should be neutral, e.g. "Введите имя тренера".

## Localization rules

- Russian is currently the default development language.
- User-facing strings belong in `src/i18n/ru.ts`.
- Future English/German support should be added by creating additional locale objects rather than rewriting screen components.
- Do not add personal information to localization, placeholder text, seed data or comments.

## Personal-data rule

The game is a general-purpose project and must contain no personal name, surname, birthday, residence, school, account information or other personal details belonging to the user.

The repository owner/URL may naturally contain a GitHub account name, but that is repository metadata, not game content. Do not copy that identity into the source, save data, UI, documentation or fictional data.

## Development workflow

Local:

```bash
git pull
npm install
npm run dev
```

Then open the Vite URL shown in the terminal, normally `http://localhost:5173/`.

Stop the dev server with **Ctrl+C**.

CI:
- GitHub Actions runs typecheck/build checks.
- A green CI result should be verified after meaningful code changes before claiming the build is healthy.

## Recovery procedure for a future ChatGPT session

Use this file together with the current repository code.

Paste/communicate this instruction:

> Continue development of the Dream Team repository from the current code. First read `GAME_RECOVERY.md` and inspect the relevant source files. Preserve the architecture and all existing features unless an explicit change is requested. The development UI is Russian. The project must remain free of personal user data. After every meaningful code change, update `GAME_RECOVERY.md` so the latest architecture, features and design decisions remain recoverable.

Then:
1. Inspect current GitHub state and recent commits.
2. Read the relevant source files before changing them.
3. Make the requested change directly in the repository.
4. Update `GAME_RECOVERY.md` in the same change set.
5. Run/verify CI or local typecheck/build when available.
6. Report exactly what changed and whether verification passed.

## Change log

### 2026-09-19 — Fixed-screen dashboard + stronger visual hierarchy
- Removed the personal-name placeholder from the career creation form.
- Removed the standalone total-save counter from the main menu and placed an explicit save number on each career card.
- Added a compact upcoming-fixtures calendar panel and a trainer-profile placeholder panel for future progression/reputation systems.
- Locked the main menu and game viewport so the page itself cannot be scrolled vertically.
- Added internal scrolling to long panels such as events, squad lists, tables and saved-career lists.
- Reworked the dashboard into a two-row priority layout that keeps the next-match action prominent and uses compact secondary panels without shrinking core controls.
- Strengthened section color separation with distinct mint, blue, gold, purple and green panel treatments.
- Redesigned the visual palette to use neutral dark surfaces plus mint, blue, gold and red semantic accents.
- Increased small-text sizes and improved hierarchy.
- Rebalanced dashboard cards, menus, forms, player rows and table spacing.
- Made the main application use a fixed viewport with independently scrollable content.
- Improved responsive behavior for desktop, tablet and mobile widths.
- Added this recovery snapshot and documented the rule to update it after meaningful code changes.

## Do not regress

- Do not reintroduce personal user information.
- Do not make the UI depend on a single accent color.
- Do not return to excessively tiny typography.
- Do not remove multiple-career saves.
- Do not make the manager name optional again.
- Do not replace automatic simulation with direct player control unless explicitly requested.
- Do not bypass the localization layer for growing amounts of UI text.
