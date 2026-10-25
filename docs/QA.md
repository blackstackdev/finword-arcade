# Finword 0.1.0 verification

Date: 25 October 2026. Status: tested browser prototype.

## Passed

- 11 deterministic Node simulation checks: connected maze, spelling and growth, repeated letters, wrong-letter penalties, turn queue and reversal rejection, wall/body/tail collision, pause, lives, game over, six-word finish, spawning and recovery when a body divides the reef.
- 8 Chromium browser scenarios at 1440×1100 and iPhone 13 viewport/touch emulation: first screen, keyboard and touch steering to a real spawned letter, score/growth feedback, pause/resume, timed movement, restart, persisted best, complete navigated six-word run with collision recovery, WebGL initialization failure, reduced motion, graphics-context loss and disabled local storage.
- Three.js renderer observed; desktop and mobile screenshots of ready, playing and win states reviewed.
- Production build succeeds; local dependency audit reported zero known vulnerabilities at install time.
- Local fonts, no external scripts, no accounts/analytics, no credential files or private source material in the publish tree.

## Test scope

Browser navigation uses real DOM key/touch input and a development-only deterministic step hook for repeatability. Actual frame-driven movement has a separate timed check. Mobile tests emulate a phone in Chromium; they do not establish physical iPhone/Safari acceptance. Audio synthesis is implemented but subjective sound comfort has not been owner-tested.

This is one original maze and six fixed words with randomized letter locations. It is a first playable game, not a claim of long-term balance or broad browser certification. WebGL uses Three.js; unavailable/lost contexts switch to a playable Canvas 2D renderer.

## Reproduce

`npm ci`, `npm test`, `npx playwright install chromium`, `npm run test:browser`, `npm run build`.

Screenshots live in `release/screenshots/`. Deployment is tested separately after publishing; see the repository's Actions run and hosted site.
