# Dream Team

Browser-based football management and simulation game.

## Development

The current development language is Russian. The UI is structured around a localization layer so additional languages can be added later without rewriting the game screens.

## Recovery snapshot

The file `GAME_RECOVERY.md` is the persistent project-context backup. It records the current architecture, gameplay direction, UX rules, storage format, localization setup, and development workflow so the project can be reconstructed if the conversation context is ever lost.

**Rule:** after every meaningful code change, update `GAME_RECOVERY.md` in the same change set.

### Local

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

### Current MVP

- automatic match simulation
- squad and tactics
- league table
- multiple independent career saves
- required manager name
- local browser persistence
- Russian development UI
- responsive dashboard layout
- fixed application viewport with independently scrollable content
