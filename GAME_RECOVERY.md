# Dream Team — current architecture

The project now uses a single WSC-style career engine instead of the previous custom football rules.

## World
- Five countries, each with a Premier division and Championship division.
- Clubs evolve between divisions every completed season.
- Squads are generated with position, age, five WSC-style visible skills, overall, potential, value and wage.
- Retirements create replacement youth players, so the world continues evolving across seasons.

## Career
- Manager reputation changes with season performance.
- Job offers can appear after completed seasons.
- A career stores season history, honours, current club, world state and transfer activity.

## Match / season
- Every round is simulated automatically for the whole world.
- The user's match is presented as a fixed-speed minute-by-minute event feed.
- League tables, scorers and assists are updated from match results.
- Player fitness changes during the season; development and aging happen at season rollover.

## Transfers
- Transfer windows are fixed during the season.
- Clubs can buy and sell players according to budget and squad size.
- AI clubs also move players during open windows.
- Player market value changes as players develop and age.

## UI
- Desktop/fullscreen management layout.
- Main career selector, squad, transfers, competition and honours.
- Squad uses the compact SPEED/PASS/SHOT/TCKL/GK/OVR roster presentation.
- The visual system is original, with a WSC-inspired management layout rather than copied game assets or source code.

## Data / saves
- Save format is v3.
- Old save formats are intentionally ignored.
