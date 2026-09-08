# Asteroids

## Run and Verify

- This is a dependency-free static site: open `index.html` directly, or serve the repository root with `npx serve .` and visit `http://localhost:3000`.
- There are no package scripts, automated tests, linters, or CI configuration. Verify changes manually in a browser.

## Structure and Constraints

- `index.html` owns the page styling and fixed `800x600` `<canvas>`; it loads `game.js` as a classic (non-module) script.
- `game.js` contains all game state, input handling, update logic, and Canvas 2D rendering. Keep changes coordinated within it rather than expecting package boundaries or a build step.
- Motion and gameplay timing use the `dt` passed by `requestAnimationFrame`; preserve the existing `0.05`-second frame-time cap when changing the game loop.
- Positions wrap through the `wrap` helper using the `W` and `H` canvas constants; use it for entities that should cross screen edges.
