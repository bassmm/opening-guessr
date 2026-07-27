# Opening Guessr

An anime opening guessing game — listen to a theme song, name the anime.

Built with [Astro](https://astro.build), [AlpineJS](https://alpinejs.dev), [daisyUI](https://daisyui.com), and [Plyr](https://plyr.io).

## How it works

1. Choose a difficulty (Top 50 / 100 / 500 / 1000 / 2500 by popularity)
2. Listen to the opening theme in audio mode (worth 1000 pts)
3. Type the anime name — search-as-you-type filters the pool
4. Optionally unlock the **blurred video** (halves the round to 500 pts permanently)
5. After 5 rounds, see your score and accuracy

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Astro](https://astro.build) 7 |
| UI logic | [AlpineJS](https://alpinejs.dev) 3 |
| Styles | [Tailwind CSS](https://tailwindcss.com) 4 + [daisyUI](https://daisyui.com) 5 |
| Media | [Plyr](https://plyr.io) with `--plyr-color-main` bound to daisyUI's `--color-primary` |
| Data | Tenrai API (popularity-ranked anime list) → AnimeThemes API (opening audio/video links) |

## Project structure

```
src/
├── components/          # Astro UI components
│   ├── AnswerCard.astro
│   ├── GameNavbar.astro
│   ├── MediaPlayer.astro
│   ├── MenuScreen.astro
│   ├── ModeToggle.astro
│   ├── ResultScreen.astro
│   └── SearchInput.astro
├── data/
│   └── fetch-openings.mjs   # Build script: Tenrai → AnimeThemes pipeline
├── layouts/
│   └── Layout.astro         # Base layout + theme selector
├── pages/
│   └── index.astro          # Entry point, components + Alpine data definition
├── scripts/
│   └── game.js              # Alpine game component (Plyr, state, game logic)
└── styles/
    └── global.css           # Tailwind + daisyUI + Pixelify Sans font
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (background mode recommended)
astro dev --background

# Check logs if needed
astro dev logs
astro dev status
astro dev stop
```

The dev server runs at `http://localhost:4321`.

## Build

```bash
pnpm build       # Prebuild fetches opening data, then Astro builds to dist/
pnpm preview     # Preview the production build locally
```

The `prebuild` step (`node src/data/fetch-openings.mjs`) paginates through the Tenrai API (2500 most popular anime), derives AnimeThemes slugs from titles, fetches opening audio/video links, and writes `public/data/openings.json`. Entries without a matching AnimeThemes opening are silently skipped (~1020 of 2500).

## Game mechanics

- **5 rounds** per game
- **Audio mode**: full 1000 pts per correct guess
- **Video unlock**: one-way, halves the round to 500 pts permanently
- **Video range**: locked to 25s–65s via native `currentTime` setter override; pressing play after 65s restarts at 25s
- **Answer validation**: search across all alternative titles (`titles` array), invalid guesses blocked with red input highlight
- **High score**: persisted in `localStorage`
- **32 daisyUI themes**: toggle via the paintbrush icon in the top-right corner
