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
- 14-match league season per club (7 home + 7 away) for the current 8-club world.
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
- The in-game background uses a slow, soft animated gradient; the career-selection start menu intentionally remains static.
- Use larger readable text; avoid excessive 8–10px labels.
- Important numbers and actions should be visually prominent.

### Layout
- Browser viewport itself should remain fixed.
- The app should occupy the full viewport height.
- On the main game screen, the top bar and application viewport stay fixed. Long content is contained inside its own panel; the page itself must not move vertically.
- On the start screen, the whole page stays fixed. The saved-career area has its own internal scroll when many saves exist.
- The start menu should fill the screen cleanly, keep rounded card boundaries visible, and expose fullscreen mode.
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
- Reworked the dashboard into a two-row priority layout with stable row sizing so post-match content cannot resize the main cards or move the navigation unpredictably.
- Strengthened section color separation with distinct mint, blue, gold, purple and green panel treatments.
- Made the main navigation stretch across the full available width with four equal tabs and individual active colors.
- Made the squad, tactics and table screens fill the remaining viewport height and use distinct blue, purple and gold visual treatments.
- Corrected the league fixture generator from 16 to 14 matches per club and limited the calendar preview/count to the 14-round season.
- Added a fullscreen toggle to both the career-selection screen and in-game header.
- Added a permanent soft animated background gradient to the in-game screen only.
- Added inner dashboard overflow and bottom spacing so card borders remain fully visible instead of being clipped at the viewport edge.
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


### 2026-09-19 — Tactics + start settings
- Replaced the formation dropdown with large selectable formation cards so the current scheme is always visible.
- Added a start-menu settings area using the previously unused lower space.
- Added working browser-persisted themes: Aurora, Midnight and Light.
- Added language controls with Russian active and English/German marked as coming soon.
- Fixed the in-game ambient background so it continuously rotates through soft colors behind the interface rather than appearing static.
- Kept the career-selection start menu itself free of animated ambient movement.

### 2026-09-19 — Full tactics controls + start menu redesign
- Replaced the remaining native tactic dropdowns with custom dark in-app menus for mentality, tempo, pressing, defensive line and width, removing the browser's white native popup.
- Kept formation selection as dedicated cards and upgraded the mini pitch diagrams to show different 4-3-3, 4-4-2 and 4-2-3-1 layouts.
- Rebuilt the start menu layout so the saved-career area spans the full lower section and scrolls internally when many careers exist.
- Removed the long introductory feature copy that could overlap the careers section and replaced it with a compact latest-update panel.
- Moved language/theme settings into a dedicated modal opened from the start-menu toolbar instead of placing a large settings card beside saved careers.
- Kept the viewport fixed while allowing the appropriate start-menu inner areas to scroll on smaller screens.

### 2026-09-19 — Start screen viewport scaling
- Rebuilt the career-selection screen around a fixed 1440×900 design canvas.
- The full start-screen canvas now scales proportionally to the available viewport using both width and height, so normal-window and fullscreen layouts keep the same relative geometry.
- Separated the toolbar from the content grid so Settings and Fullscreen controls cannot overlap the hero or career cards.
- Kept the saved-career section anchored to the entire lower row; many saves scroll inside that section instead of pushing the layout upward.
- Kept the fixed-viewport rule and avoided relying on stacked responsive breakpoints for the desktop start screen.

### 2026-09-19 — Performance + scrollbar polish
- Replaced the expensive full-screen blurred rotating background layers with lightweight transform-based ambient motion.
- Removed the topbar backdrop blur to reduce compositor work.
- Paused ambient background animation while the tactics tab is active to prioritize interaction smoothness there.
- Added custom scrollbar styling across saved careers, squad/player lists, dashboard/timeline, league table, tactics panel, calendar and other scrollable areas.
- Tightened text layout rules with stable flex/grid sizing, no-wrap/ellipsis for save metadata and consistent button alignment.
- Improved the Dream Team DT marks so their glyphs are not visually clipped.
- Kept the fixed 1440×900 start-screen canvas and proportional viewport scaling.

### 2026-09-19 — Save management + tactics polish
- Replaced the browser-native save deletion confirmation with an in-game confirmation modal so deleting a career does not trigger a browser dialog or force the fullscreen context to close.
- Saved careers are ordered by creation time, oldest first; playing/updating a career no longer moves it to the first position.
- Stored careers now expose their original creation timestamp and show the added date/time in the save card.
- Added a stable empty-careers heading so the start-menu section does not jump when the save list becomes empty.
- Added proper card-based language/theme cells inside the settings modal.
- Tactic dropdown menus now use absolute positioning and overlay neighboring fields instead of changing grid height.
- Replaced the text arrow on tactic selectors with a CSS chevron that rotates cleanly when opened.
- Reworked formation mini-pitches to use explicit 11-player positions for 4-3-3, 4-4-2 and 4-2-3-1 instead of generic/random-looking dots.


### 2026-09-19 — Start screen + ambient lighting correction
- Removed the standalone DT badge/orb elements from above the start-screen hero heading so no clipped blue/green texture appears above the “БРАУЗЕРНЫЙ ФУТБОЛЬНЫЙ МЕНЕДЖЕР” eyebrow.
- Moved the Dream Team title area upward and constrained the hero row so the “ВАШИ КАРЬЕРЫ” section cannot be overlapped by the latest-update panel.
- Reworked the three formation mini-pitches to use clearer, explicit 11-player rows for 4-3-3, 4-4-2 and 4-2-3-1 with pitch markings.
- Replaced the in-game ambient background’s large circular field with a multi-layer rectangular gradient field containing mint, blue, violet and subtle gold lighting that drifts independently.
- Removed the remaining start-menu orb JSX so the clipped texture cannot reappear above the hero area.

### 2026-09-19 — Formation diagram redesign
- Rebuilt the formation preview as a portrait-oriented mini pitch instead of a short horizontal strip.
- Added role-aware player markers: keeper, defenders, midfielders and attackers now use separate visual colors.
- Changed 4-3-3 to a recognizable midfield triangle: one deeper midfielder with two more advanced midfielders, plus wide wingers and a central forward.
- Kept 4-4-2 as a flat four-player midfield line with two forwards.
- Kept 4-2-3-1 as a back four, double pivot, attacking three and lone striker.
- Added clearer pitch markings and increased the formation cards so the 11-player structure can be read at a glance.

- Added full directional pitch markings to the formation cards: own goal/penalty area at the bottom with the goalkeeper, opponent goal/penalty area at the top, plus the halfway line and center circle.
