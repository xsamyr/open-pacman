# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone (no frameworks, no build step, no dependencies).

## Run / verify

- No `package.json`, bundler, linter, or tests. Verify by opening `src/index.html` in a browser (or serving `src/` with any static server).
- There is no test command; exercise the game manually. Winning = eating all dots; losing = 3 collisions with ghosts.

## Script wiring (important)

- `src/index.html` loads four plain `<script>` tags in this exact order: `maze.js` → `game.js` → `render.js` → `main.js`.
- These are **not** ES modules and there is no import/export. They communicate through globals: `maze.js` publishes `window.MAZE/TUNNEL_ROW/PACMAN_START/GHOST_STARTS`, `game.js` publishes `createGame/update/DIRS`, `render.js` publishes `draw`. Adding a new JS file means adding a `<script>` tag in the correct position.
- `game.js` and `render.js` rely on globals from previous scripts (`MAZE`, `DIRS`, etc.) being loaded first.

## Architecture

- `src/js/maze.js` — maze as 31 strings × 28 chars, parsed to numbers: `1` wall, `2` dot, `3` pen door, `0` empty. `MAZE` is pristine; `createGame()` deep-copies rows into `game.grid` each match.
- `src/js/game.js` — pure state/rules: movement, ghost AI (`hunter` chases, `random` wanders), collisions, scoring (~10/dot), lives, tunnel wrap. No drawing, no DOM.
- `src/js/render.js` — canvas drawing only, reads `game.grid` (not `MAZE`) so eaten dots disappear.
- `src/js/main.js` — DOM/canvas wiring, keyboard, overlay screens, and the `requestAnimationFrame` loop.

## Gameplay conventions / gotchas

- Simulation is **frame-based, not time-based**: pacman `0.125` cell/frame, ghosts `0.1` cell/frame. Movement snaps to integer cells when `aligned()` (<1e-3) and turns/branches only at cell centers. Don't introduce delta-time without reworking speeds.
- Coordinates are cell-based `{x, y}` with origin top-left. `TUNNEL_ROW = 14` wraps horizontally.
- Pen door (tile `3`) blocks Pac-Man but not ghosts; tunnel edges are traversable only on `TUNNEL_ROW`.
- Canvas is fixed `560×620` = 28×31 cells at `TILE = 20` (in `render.js`). Changing maze dimensions requires updating both the canvas attributes in `index.html` and `TILE`.
- UI/overlay text and most comments are Spanish; source style uses spaced parentheses (`function foo( a )`) and 2-space indent. Match it.

## Spec-driven workflow

- This repo is a learning sandbox for spec-driven development. Skills live in `.agents/skills/` (`spec`, `spec-impl`); they are `disable-model-invocation`, so the user must invoke `/spec` or `/spec-impl` explicitly.
- Specs go in `specs/NN-slug.md` (not created yet; numbering starts at `01`). State must be `Approved`/`Aprobado` before `/spec-impl` proceeds; `Draft` blocks implementation. `specs/.spec-config.yml` controls `AutoCreateBranch` (default `true`).
- Per the workflow: do not write code during `/spec`, do not commit automatically, and implement approved specs step by step with pauses for diff review.
- Commit/branch expectations otherwise: one initial commit exists (`27f856c`); no branch/PR template is defined.
