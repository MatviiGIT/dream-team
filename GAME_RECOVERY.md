### 2026-09-20 — Final League Table typography pass
- Unified the «Игры» and «Форма» overview labels with the same typography as neighboring overview labels instead of using a special lowercase/unstyled treatment.
- Increased all main League Table row numbers and text again: numeric cells, goals for/against, goal difference and points now use large bold tabular numerals; club names, ranks and form indicators were enlarged accordingly.
- Increased table header typography and row padding so readability is prioritized over fitting many teams into a short viewport.
### 2026-09-20 — Responsive follow-up for readable table and tactics scale
- Kept the enlarged Tactics controls responsive on tablet/mobile widths by reducing outer padding while retaining larger labels, buttons and selectors.
- On narrow screens the tactic controls use one column so full labels remain readable instead of being compressed into two narrow columns.
### 2026-09-20 — Larger readable table and tactics controls
- Removed horizontal scrolling from the League Table; the table now uses fixed column proportions and only the table container may scroll vertically when the list becomes long.
- Replaced abbreviated table headers («И», «В», «Н», «П», «ЗГ», «ПГ», «РЗ», «ОЧК») with full words such as «Игры», «Победы», «Ничьи», «Поражения», «Забито», «Пропущено», «Разница» and «Очки».
- Kept the Form column wide and centered while increasing row height, typography, club names, numeric values and form indicators so readability is prioritized over fitting many rows on screen.
- Added a simple «Форма» label to the overview form card instead of the deleted helper copy.
- Increased the whole Tactics screen scale: heading, formation block, formation buttons, tactic labels, selectors, dropdown options and spacing now use the available workspace more deliberately.

### 2026-09-20 — Removed obsolete table color layer
- Removed the old orange League Table background layer from the CSS so the final neutral rounded dark surface is the only active table-card treatment.
- The Squad pitch wrapper now has an explicit single-row layout with zero gap; the field itself, not a leftover helper gap, owns the available vertical space.

### 2026-09-20 — League table spacing and alignment correction
- Removed the remaining horizontal/visual clutter from the league table: no club-color dots, no «Последние 5» or «Осталось N туров» helper text, and no leftover pitch gap from the deleted Squad helper strip.
- Centered the Form column and its W/D/L indicators with a dedicated table column width.
- Increased the League Table heading, overview cards, row typography, club names, numeric cells, ranks and form indicators; numeric table values are intentionally bold.
- Replaced the old orange table-card surface and orange user-row tint with the neutral dark rounded surface and mint user-row emphasis used by the rest of the management UI.
- Removed the obsolete table-club-dot styling and the unused localization entries for the deleted helper text.

### 2026-09-20 — Expanded league table and removed redundant visual elements
- Removed the leftover 10px gap below the Squad pitch; the old gap belonged to the deleted pitch helper strip, so the field now uses the available team-sheet height directly.
- Removed club-color dots from every league-table row and removed the «Последние 5 / Осталось N туров» helper text from the form summary.
- Centered the «Форма» table column over its five W/D/L indicators with a dedicated column width.
- Reworked the League Table card toward the same neutral rounded dark surface as the rest of the game instead of the previous orange-tinted background.
- Increased the League Table overview cards, headings, team names, row numbers, table numbers and form indicators; table values are now visibly bold and the table uses more of the available horizontal space.

### 2026-09-20 — Simplified in-game navigation and squad layout
- Removed the redundant in-game Dream Team brand block and compact club identity block from the persistent sidebar; the active screen and Overview already provide the relevant context.
- Removed decorative navigation icons/emblem-like marks before section names and increased the section-menu typography so «РАЗДЕЛЫ» and the actual section names use a coherent hierarchy with centered labels.
- Removed non-essential helper copy from the in-game Overview, Squad, Tactics, Transfers and Contracts surfaces to reclaim space; functional errors, statuses, empty-state messages and actions remain.
- Removed the permanent Squad instruction strip below the pitch so the bench can share the same full-height row as the field.
- Changed the reserve roster to hide horizontal overflow, adapt its columns to available width and keep the player list vertically scrollable.
- Rebalanced the Squad grid so the reserve panel has enough width for its text without horizontal scrolling.

### 2026-09-20 — Corrected penalty-area width relative to the goal
- Corrected the squad pitch penalty-area width to use the IFAB construction: 16.5 m from the inside of each goalpost, rather than 16.5 m from each touchline.
- On the 68 m-wide reference field this gives a 40.32 m penalty-area width, making the 9.15 m-radius penalty arc proportionate to the actual field geometry.
- Kept the penalty mark at 11 m and the penalty arc radius at 9.15 m.

### 2026-09-20 — Fixed squad pitch stretching at the SVG coordinate level
- Identified that the stretched circles came from the SVG using `preserveAspectRatio="none"` with a 68 × 52.5 viewBox inside the intentionally lengthened desktop pitch.
- Rebuilt the marking coordinate space as 68 × 68 and scaled the real field coordinates vertically instead of distorting the SVG viewport.
- Restored the centre circle and penalty arc to true SVG circles with radius 9.15; they no longer need manual vertical compensation.
- Updated penalty-area, goal-area, penalty-spot, goal-net and rounded-boundary coordinates to the new vertical field scale.

### 2026-09-20 — More vertical space for the desktop squad pitch
- Rebalanced the desktop Squad team-sheet columns toward the pitch so the field has more horizontal room while keeping the roster usable.
- Lengthened the desktop visual pitch canvas to a 68 x 68 display ratio; the internal SVG still uses the same real field-coordinate system for the markings, with the visual canvas intentionally stretched to use the available fullscreen space.
- Kept the narrow-screen breakpoints responsive rather than applying the desktop stretch blindly to mobile.
### 2026-09-20 — Corrected circular markings on stretched squad pitch
- Removed the separate top halfway-line element because the rounded outer field boundary already provides the visible top/halfway line.
- Changed the centre-circle and penalty-arc primitives from SVG circles to vertically compensated ellipses so they render visually circular after the intentional extra vertical pitch space is applied.
- Kept the actual field-coordinate centres and 9.15 m horizontal radius while compensating the vertical axis for the 68 × 56.5 visual canvas.

### 2026-09-20 — Squad pitch uses available vertical space with rounded SVG boundary
- Changed the squad pitch sizing so the desktop pitch uses the full available height of its team-sheet column instead of being limited primarily by a fixed width/aspect-ratio box; width remains capped by the available column.
- Rebuilt the SVG perimeter as a rounded path matching the visual corner radius, so the white field boundary follows the rounded corners instead of being cut off by the container's clipping.
- Shortened the top halfway-line segment to the straight portion between the rounded corners.

### 2026-09-20 — Squad pitch length, corners and goal-net alignment
- Extended the visual squad-pitch canvas from 68 × 52.5 to 68 × 56.5 proportions so the field uses more of the available vertical space while preserving the existing internal layout relationship.
- Added moderate 14px rounded corners to the field container; the SVG marking layer remains clipped to those corners.
- Extended the goal-net path to the exact bottom goal-line coordinate (y=52.5) so no small unfilled gap remains beneath the net.
- Kept the single-boundary approach and the open penalty-area/goal-area paths from the previous cleanup.

### 2026-09-20 — Squad pitch border cleanup
- Removed the duplicate CSS container border so the pitch perimeter is drawn only once by the SVG field marking.
- Kept the halfway line as the top edge marking and changed the outer SVG boundary to draw only the two side lines plus the bottom goal line, preventing a second line from sitting inside the field.
- Changed the penalty-area and goal-area shapes to open paths without a bottom horizontal segment, so the shared goal-line/boundary is the only line at the back of the penalty areas.

### 2026-09-20 — Rebuilt squad pitch from field coordinates
- Replaced the squad-pitch's manually positioned CSS marking spans with a single inline SVG coordinate system sized as a 68 m × 52.5 m own-half from a 68 m × 105 m full field.
- The pitch now uses explicit real-world field relationships for the halfway line, centre circle, penalty area (16.5 m), goal area (5.5 m), penalty mark (11 m) and penalty arc (9.15 m), avoiding visual drift caused by independent percentage positioning.
- Removed the decorative rounded corner treatment from the playing surface and kept the field boundary rectangular.
- Reworked the goalmouth as a simple aligned goal frame/net attached to the lower goal line so it cannot float independently of the field.
- Player-marker positioning remains separate and interactive; the SVG is only responsible for the pitch markings and goal geometry.

### 2026-09-20 — Squad pitch geometry + transfer dropdown theme cleanup
- Removed the separate squad-pitch corner arcs and reduced the field container rounding so the football-field markings read as a clean square/rectangular playing surface instead of mixing rounded-corner treatment with rectangular field lines.
- Corrected the squad penalty spot/arc relationship: the penalty arc is now a true circular half-arc centered on the penalty spot, rather than a shallow oval sitting too far upward.
- Repositioned and resized the squad goalmouth to align with the goal line and use a realistic goal-width proportion for the field.
- Removed the season/round badge from the dedicated Finances screen and from the League Table header; the overview header keeps its season/round context.
- Recolored the custom transfer-market dropdown trigger, arrow, menu and active/hover states from the Tactics purple palette to the Transfer Center gold palette.
- Management dropdowns remain custom in-app controls; future sliders should follow the same non-native visual language.

### 2026-09-20 — Single-half squad pitch + custom transfer filters
- Reworked the Squad team sheet into a single own-half pitch: the top edge represents the halfway line, the centre circle is shown only as the near half of the circle, and only the user's goal end is rendered.
- Removed the unused opponent-half penalty area, goal, centre-half markings and top corner arcs from the Squad pitch.
- Repositioned the starting-XI formation slots so every player sits within the displayed own half.
- Reworked the pitch geometry toward the official IFAB field proportions and marking relationships, including penalty-area/goal-area sizing, penalty spot placement, the penalty arc, and an integrated goalmouth presentation.
- Replaced native transfer-market Club, Nationality and Role select controls with custom in-app dropdown menus matching the interaction pattern used by Tactics: overlay menus, custom arrow, active option state and checkmark.
- Future management dropdowns and range sliders should use the same custom in-app control language rather than browser-native controls.


### 2026-09-20 — Squad field and native dropdown readability
- Rebuilt the Squad team-sheet pitch as a complete vertical football field with consistent proportions, inset boundary lines, half-way line, centre spot, penalty spots, penalty arcs, corner arcs and connected goal/net areas.
- Repositioned the goal graphics inside the pitch geometry so they no longer appear detached from the field or visually outside the goal line.
- Added subtle mowing stripes and layered lighting/edge treatment while keeping player markers and responsive sizing intact.
- Added explicit dark/light native-select styling and color-scheme handling so dropdown options such as club and nationality remain visible instead of appearing as blank white cells.
# Dream Team — Recovery Snapshot

> Persistent context file for restoring the project direction if the surrounding chat context is lost.
> This file intentionally contains project information only and must not contain the user's personal name or other personal data.

### 2026-09-20 — Transfer market + contract center refinement
- Split the external transfer market from owned-player management.
- Added player nationality, transfer-list status and contract metadata with migration for existing saves.
- Added a dedicated filter menu for position, club, nationality, role, age, OVR, potential and preferred foot.
- The transfer market now only contains external players explicitly listed by their clubs; buying removes them from the market and updates budget/wages.
- Added a separate «Контракты» screen for owned players, renewal offers, signing bonuses and transfer-list controls.
- Added a contract-expense line to club finances.
- Reworked the in-game section palette so the active screen changes accent color instead of keeping every management screen blue.
- Reworked the team-sheet pitch sizing so the complete field, including both ends, stays visible inside the available viewport.

### 2026-09-19 — Transfer market MVP
- Added a dedicated «Трансферы» management screen with player search and position filters.
- Added deterministic transfer pricing based on player value, age, potential and club reputation.
- Added buying from rival clubs; purchases reduce the manager's transfer budget and increase the wage bill, while the seller receives the fee and frees the player's wages.
- Added selling of non-starting players; the user's starting XI cannot be sold directly and squad depth is kept at a minimum of 15 players.
- Added transfer-specific finance tracking for seasonal transfer income/expenses and the latest transfer transaction.
- Kept the existing save version compatible by migrating missing finance fields through the existing finance migration path.

### 2026-09-20 — CI fix after transfer/contract refactor
- Removed the stale `getSquadRole` reference from `TransferMarket.tsx` after role data was moved to the persistent player contract metadata.
- No gameplay behavior changed; this is a compile/typecheck correction only.

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
- Transfer market with player search, filters, market-listed external players and purchases.
- Contract center for owned players, contract renewals and transfer-list status.
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
  - Tab navigation including transfers and contracts.
  - Match simulation trigger.
- `src/domain/types.ts`
  - GameState, Player, Club, MatchResult, Fixture, TableRow, Tactics and related types.
- `src/game/career.ts`
  - Career creation.
  - Fixture generation.
  - League table updates.
  - Next-round simulation.
- `src/game/transfers.ts`
  - Deterministic transfer pricing.
  - Market-list availability and external-player purchases.
  - Transfer-list toggling for owned players.
  - Budget, wages and transfer-finance updates.

- `src/game/contracts.ts`
  - Contract role derivation and renewal offers.
  - Renewal signing bonuses and wage adjustments.
  - Contract-expense tracking through club finances.

- `src/components/Contracts.tsx`
  - Owned-player contract center.
  - Renewal modal and transfer-list controls.

- `src/styles/contracts.css`
  - Contract-center layout and renewal modal styling.

- `src/components/TransferMarket.tsx`
  - Searchable/filterable transfer market screen.
  - Buy/sell interactions and action feedback.

- `src/styles/transfers.css`
  - Transfer screen layout and responsive presentation.

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
- `src/styles/transfers.css`
  - Transfer-market-specific layout and responsive rules.
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


### 2026-09-19 — Team sheet / lineup management
- Moved formation visualization out of the Tactics screen and into the Squad screen as a full team-sheet pitch.
- Added persistent optional starting-XI data to clubs so lineup changes survive save/load while older saves remain compatible.
- Added interactive player swapping: select a player on the pitch, then another player on the pitch or roster to swap their slots.
- The automatic match simulator now builds team profiles and scorer candidates from the selected starting XI.
- Tactics now uses compact formation selector buttons without miniature formation diagrams.
- Added a roster panel beside the pitch so the Squad screen is the main place for lineup management.

- Completed the team-sheet pitch markings after moving the formation view out of Tactics, including full penalty areas and goals on the new large pitch.


### 2026-09-19 — Visual refinement pass
- Unified the in-game topbar, club header and navigation with the same layered dark visual language and semantic accent colors.
- Added subtle card hover depth, cleaner active-tab indicators and more consistent table row treatments.
- Refined the team-sheet field, player markers and roster cards so the Squad screen reads as a single polished management surface.
- Polished formation and tactic controls with clearer hover/open states and stronger visual hierarchy.

### 2026-09-19 — Career selection + season snapshot polish
- Removed the upward hover translation from saved-career cards so their top edge and manager avatar never get clipped by the scroll container.
- Kept hover feedback through border, shadow and avatar treatment instead of moving the whole save card.
- Reworked the «Состояние сезона» metrics into four independent rounded tiles with small semantic accent bars, removing the old cross-shaped separator lines.

### 2026-09-19 — Full squad depth
- Expanded newly generated clubs from 11 to 18 players: 2 goalkeepers, 6 defenders, 6 midfielders and 4 forwards.
- Added automatic squad-depth migration for existing v2 and legacy careers so old saves gain the additional players when they are loaded/saved.
- Made reserve players functional in the team sheet: selecting a starter and then clicking a reserve player replaces that position.
- Updated the lineup instruction so the UI explicitly explains the reserve replacement action.
- Kept the selected starting XI as the only group used by the match simulator, so reserve players do not affect matches until they are promoted into the XI.

### 2026-09-19 — Player condition and form loop
- Added post-match player progression: starters receive an appearance, goal totals from the match events, reduced fitness and a form change based on result/scoring.
- Reserve players recover fitness after each round and their form gradually returns toward neutral.
- Added a compact «Тонус» value to the squad roster so rotation decisions are visible before a match.
- The match simulator still uses only the selected starting XI, so fatigue and form now make lineup rotation materially useful.

### 2026-09-19 — Dashboard layout stability fix
- Prevented the overview dashboard itself from gaining/removing a scrollbar when match data changes, which could shift the grid and make surrounding menu/card geometry jump after a simulation.
- Reserved scrollbar space on the dashboard and isolated the manager profile card's layout so changes inside it cannot trigger broader reflow.

### 2026-09-19 — Manager card height lock
- Locked the «Профиль тренера» card to fixed internal rows so its placeholder note can no longer change the dashboard card height.
- Reserved a constant 38px area for the future-note text and clipped overflow inside that area, preventing the note from appearing/disappearing as a cause of layout shifts.

### 2026-09-19 — Removed unstable manager placeholder
- Removed the temporary «Здесь появятся расширенная репутация...» note from the manager-profile card because the second dashboard row is intentionally compact and the note could be clipped or alter perceived card height.
- Kept the manager card as a compact fixed-layout dashboard panel; the future trainer progression content will return when it has real data and interaction.

### 2026-09-19 — Dashboard intrinsic-size hard lock
- Removed intrinsic content sizing from dashboard row calculations by changing all dashboard tracks to `minmax(0, fr)` tracks.
- Forced every dashboard card to fill its assigned track with `height: 100%` and `max-height: 100%`.
- Added layout containment to the dashboard so changing match/event content cannot propagate size calculations back into the dashboard shell.
- Applied equivalent fixed track logic to tablet and mobile layouts.

### 2026-09-19 — Absolute in-game viewport geometry
- Replaced the flexible vertical shell sizing with an explicit viewport grid: fixed topbar height plus a fixed remaining content viewport.
- Locked the in-game header to 80px on desktop, 70px on tablet and 64px on narrow mobile.
- Locked the main content to the remaining viewport height so match results cannot change the global available height.
- Removed dashboard card hover translation so no card can visually shift after a click while the pointer remains over it.


### 2026-09-19 — Match Center
- Added a post-simulation Match Center overlay without changing the save model or fixture schema.
- The simulation result now opens immediately after the user's match and shows the final score, win/draw/loss state, scorers, full event timeline and core match statistics (xG, possession, shots).
- Match Center is fixed to the game viewport and scrolls only its internal event list, so it cannot participate in dashboard sizing or reintroduce the previous post-match layout shift.
- Closing Match Center returns the player to the updated Overview, where the season table, latest result, timeline and next fixture remain available.
- Added all new user-facing strings to the Russian localization layer.


### 2026-09-19 — Match Center round metadata
- Match Center now stores the exact season and round from before simulation, so a final-round result remains labeled with the season and round that were actually played.
- Added an internal mobile overflow guard so the Match Center's event/stat panels remain usable on short screens.


### 2026-09-19 — Tactical match impact
- Connected the selected starting XI to the chosen formation during match simulation. Each lineup slot now has a formation-specific expected position, so players used outside their natural positional role reduce tactical execution slightly.
- Made mentality, tempo, pressing, defensive line and width affect attack, defense and possession with modest, deterministic modifiers rather than relying on a single generic tactic value.
- Added small player-attribute checks for tactic execution: pace matters more for fast tempo/high pressing, passing supports slow-possession styles, and defending supports aggressive pressing.
- Kept the current fitness drain rule unchanged; stamina will be tied to tactical workload later as planned.
- No save-model changes were required.
- Stored the calculated tactical possession modifier in each team profile so the simulator uses one consistent calculation per team.

### 2026-09-19 — Squad substitution clarity
- Replaced English pitch-position abbreviations (GK/LB/CB/etc.) with Russian football abbreviations (ВРТ, ЛЗ, ЦЗ, ПЗ, ОП, ЦП, ЛП, ПП, ЛФ, АП, ПФ, ЦН).
- Reworked the Squad sidebar to show only non-starting players as the dedicated «Скамейка / Запасные» pool, closer to the requested quick team-management pattern.
- Selecting a starter now clearly shows the player being replaced and the exact pitch position targeted.
- Clicking another starter is visually presented as a position swap; clicking a bench player performs the replacement.
- Bench players are color-coded by positional fit: «На своей позиции», «Можно поставить» and «Не по позиции». The game does not block an out-of-position replacement; the simulator remains responsible for applying positional consequences.
- Clarified terminology: reserve/bench describes the player pool, while замена describes the action of replacing a starter.

### 2026-09-19 — Player match ratings + individual stats
- Extended MatchResult with optional playerStats so older saved matches remain compatible.
- Added optional assist tracking to match goal events.
- The match simulator now generates deterministic per-starter statistics for each played round: minutes, rating, shots, goals and assists.
- Player ratings combine baseline player quality/form, positional fit inside the chosen formation, team result, attacking contributions and clean-sheet bonuses for goalkeepers/defenders.
- Goal events can now carry an assisting player, and the event timeline displays the assist in Russian.
- Persisted simulated assists into each player's season assist total and allowed assists to contribute modestly to player form.
- Added a two-column individual ratings panel to Match Center with both teams' starting XI and compact rating/goals/assists/shots readouts.
- Kept the existing fitness drain unchanged; stamina/tactical workload remains a later system.
- Ensured generated player shot totals always include their scored goals so per-player match stats cannot report a goal with zero shots.
### 2026-09-19 — Match Center ratings panel sizing
- Rebalanced Match Center body rows so the individual player ratings section receives the main vertical space instead of being compressed below the event/stat panels.
- Kept the event timeline and match-number panels usable by giving them a smaller, fixed minimum area with their own internal overflow.
- Added the same thin custom scrollbar treatment and stable scrollbar gutter to both player-rating lists.
- Added a mobile-specific row balance so the player ratings remain the largest section on narrow screens as well.
### 2026-09-19 — Match Center rating readability + sorting
- Sorted each team's player ratings from highest to lowest rating.
- Increased player-name, position, rating and stat typography and row height so the ratings table is comfortable to read.
- Rebalanced Match Center vertical space so the rating table cannot extend behind the «Продолжить» button; overflow stays inside the rating lists.
- Reduced padding/space in the upper timeline and match-stat panels to give the ratings section more usable room.
- Kept the custom scrollbar on the individual rating lists and the existing mobile overflow behavior.
### 2026-09-19 — Match Center expanded layout
- Expanded the Match Center modal to use more of the desktop viewport, reducing cramped horizontal text wrapping around the final score.
- Reduced the vertical footprint of the top scoreboard while keeping the score and team identities prominent.
- Increased the width available to the timeline and match-stat panels so all core statistics can be shown together.
- Rebalanced vertical rows so the timeline and match statistics receive substantially more space while the player ratings panel remains the largest detailed section.
- Kept the mobile-specific layout and internal scrolling behavior intact.
### 2026-09-19 — Layered Match Center detail menus
- Reworked Match Center into a compact post-match summary with three dedicated detail entry cards: chronology, match statistics and player ratings.
- Each detail section now opens in a second fixed overlay above the current Match Center rather than competing for space inside the main result screen.
- The chronology detail uses a dedicated custom scrollbar consistent with the rest of the application.
- Player ratings remain sorted best-to-worst and open in their own larger scrollable detail view.
- This layered approach keeps the final score readable while allowing detailed panels to use larger typography and more vertical space.
### 2026-09-19 — Match Center summary balance
- Added a compact match-summary strip to the main Match Center with xG, possession, shots and the player of the match.
- Kept detailed chronology, statistics and player ratings behind separate layered menus so the main Match Center remains readable without feeling empty.
- Made all three detail entry cards use the same minimum height and stretch behavior so the chronology card no longer looks shorter than its neighbors.
- The main result view now acts as a clear post-match dashboard, while detailed information remains available one level deeper.
### 2026-09-19 — Match Center timeline card alignment
- Renamed the Match Center chronology entry-card class so it no longer collides with the global timeline list styles.
- This removes the unintended top offset/overflow behavior that made the chronology entry card sit lower than the statistics and player-rating cards.

### 2026-09-19 — Matchday flow + summary readability
- Increased the main Match Center summary typography and card height so xG, possession, shots and Player of the Match are readable without shrinking the interface elsewhere.
- Refined the Overview next-match panel into a clearer matchday entry point with explicit round progress, home/away context and a ready-for-match status.
- Renamed the primary action from «Симулировать матч» to «Играть матч» to make the career loop feel like entering the next fixture rather than opening a developer-facing simulation control.
- Kept this pass presentation-only: no new saved game parameters or simulation rules were introduced.

### 2026-09-19 — Calendar scrolling + readability pass
- Made the full upcoming-fixtures modal a fixed-height flex container so the fixture list owns the available scroll area and the «Закрыть» button stays visible.
- Added stable internal scrolling to the 14-round calendar list so all remaining fixtures can be reached without pushing the modal action below the viewport.
- Increased several recurring small UI text sizes across the overview, calendar, squad, table and Match Center while preserving compact labels where they are purely decorative.

### 2026-09-19 — Calendar modal isolation + typography scale correction
- Gave the «Ближайшие туры» window a dedicated overlay layer above the in-game topbar/content so background tabs and controls cannot be activated while the modal is open.
- Kept the calendar fixture list in its own internal scroll region with the close action outside that region.
- Added a stronger in-game typography scale for recurring labels, metadata, fixture text, squad data, table cells and Match Center details so important information is not rendered at near-technical-label size.

### 2026-09-19 — Calendar modal viewport lock
- Changed the upcoming-fixtures modal to use a strict viewport-bounded height instead of relying on content-driven sizing.
- Made the fixture list a zero-basis flex scroll region (`height: 0` + `flex: 1`) so all 14 rounds scroll inside the window without pushing the modal itself beyond the viewport.
- Kept the modal header and «Закрыть» action fixed outside the scrolling fixture list.

### 2026-09-19 — Calendar modal portal rendering
- Moved the full «Ближайшие туры» modal out of the dashboard DOM subtree and render it through a React portal directly under `document.body`.
- This makes the calendar overlay independent of dashboard containment/overflow and guarantees that it covers the complete game viewport like Match Center.
- The fixed-height internal fixture list and bottom «Закрыть» action remain in place, so scrolling the calendar cannot expose or activate underlying tabs.

### 2026-09-19 — League table visual refinement
- Reworked the league table into a two-level management screen: a compact season snapshot for the manager's club plus the full league standings.
- Added a derived last-five form display using existing played fixture results, with W/D/L badges and no save-model changes.
- Increased table readability with clearer rank badges, club-color markers, larger cells, explicit goal difference, and stronger highlighting for the user's club.
- Kept the underlying table sorting and 14-round league logic unchanged.

### 2026-09-19 — Remove permanent in-game topbar
- Removed the large fixed in-game top navigation bar that displayed Dream Team branding, season, round, manager name, fullscreen and career navigation.
- The in-game shell now uses the full viewport height instead of reserving an 80px desktop / 70px tablet / 64px mobile top row.
- Fullscreen remains available as a compact floating control in the bottom-right corner with an accessible label/title.
- Career navigation was moved into the existing club header alongside the transfer budget, preserving the ability to return to the career menu without restoring the wasted vertical space.
- Start-screen fullscreen behavior remains unchanged.

### 2026-09-19 — Wide three-zone in-game workspace
- Replaced the centered 1180px in-game workspace with a full-width desktop shell.
- Main game layout now uses three zones on wide screens: left persistent navigation, central active screen, and right utility rail.
- Moved the existing section navigation (Overview, Squad, Tactics, Table) from a horizontal tab bar into the left sidebar.
- Added a right-side finance preview using already-existing club budget and wage data; this is presentation only and does not introduce new financial simulation logic.
- Added a small season/round context panel to the right rail.
- Preserved fullscreen as a floating control and kept career-menu access in the left sidebar.
- Responsive behavior: at medium widths the right rail is hidden to protect the main screen; on small screens navigation becomes horizontal and the main area remains usable.

### 2026-09-19 — Initial working finance system
- Added optional per-club finance state with season income/expenses and last-round breakdown fields.
- Added a dedicated src/game/finance.ts engine for deterministic round finance.
- Each league round now applies stadium/matchday income, media income, result bonus and one-round wage expense to every participating club; the net changes the club's existing transfer budget.
- Existing saves are migrated by creating zeroed finance state when missing; save version remains compatible.
- Added a dedicated Финансы screen to the left navigation with current budget, wage cost, season income/expenses and the latest round ledger.
- The right utility rail shows a compact finance preview using the same live budget and wage data.
- Finance is intentionally limited to cashflow for now; transfers, contracts and richer accounting are future systems.

### 2026-09-19 — Full-width management screens and squad readability fix
- The large `Ваш клуб` header and right finance/season rail are now shown only on Overview; Squad, Tactics, Table and Finance use the available central width.
- Non-overview screens therefore use a two-zone layout: persistent left navigation plus an expanded main workspace.
- Fixed the Squad reserve-card grid: the markup has five data elements, so the grid now explicitly uses five columns instead of relying on an implicit fifth column.
- Increased reserve-card avatar, name/position, OVR and fitness readability and added controlled fit-status badges.
- Added responsive fallbacks that collapse secondary reserve information on very narrow screens instead of allowing overlap.

### 2026-09-19 — Match score and squad consistency cleanup
- Compact match scores now use a fixed numeric presentation such as `1 : 0` instead of a long dash, with tabular-number spacing to prevent visual jumping.
- The right-side season preview was removed from Overview because season/round context is already present in the club header.
- Fullscreen was moved from the floating bottom-right corner into the left navigation action row beside Career, avoiding overlap with Squad content.
- Verified that generated squads use two goalkeeper slots in the 18-player position template.
- Fixed the deeper starting-XI issue: initial lineups are built by formation role, so exactly one GK starts and the second GK stays available as a reserve.
- Existing saved lineups with duplicate/missing goalkeepers are repaired on migration/load; ordinary formation changes are not treated as a lineup corruption and are left alone.
- Expanded reserve-card layout remains active on non-Overview screens so player position, name, OVR, fitness and fit-status do not collide.

### 2026-09-20 — League Table overview scale
- Doubled the visual scale of the League Table's top overview cards: labels, headline values, suffixes and form indicators are now substantially larger for at-a-glance readability.
- Increased the overview card padding and minimum height so the larger typography has enough breathing room without changing the standings table below.

### 2026-09-20 — League Table recent-form fit
- Kept the enlarged League Table overview scale unchanged while narrowing only the «Последние 5 игр» card's horizontal padding and reducing its five form indicators to fit cleanly inside the card.
- This avoids a global padding reduction that would unnecessarily change other management screens.

### 2026-09-20 — League Table compact headings and rank readability
- Removed the visible `#` heading from the position column while keeping the rank numbers themselves.
- Shortened standings headings to common football-table abbreviations: И, В, Н, П, МЗ, МП, РМ, О.
- Increased the standings header typography and enlarged the position badges, with an extra readability bump for the user's club rank.

