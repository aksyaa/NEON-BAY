# NEON-BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aksyaa/NEON-BAY/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aksyaa/NEON-BAY/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** is an original open-world crime game in the spirit of GTA 6. Mara Reyes, a former courier, owes the wrong people money — so she works the debt off across a sun-soaked neon coastal city: Marina Beach, Downtown Neon, Portside and Old Town. Drive, steal, run, and pay the debt before the city pays you back.

Everything is procedural: the city, the cars, the people, the sunset light and the synth radio are all built by code. No external assets, no network requests — Three.js is vendored under `game/vendor/`.

## What's in the game

- **Open world on foot and by car** — enter and exit any car with F, drift with Space, camera orbits with the mouse.
- **Traffic and pedestrians** — civilian cars drive the road grid, people walk the sidewalks (and run when shots are fired).
- **Wanted system, 1–5 stars** — stealing, crashing and shooting draw heat; patrol cars chase and ram, and at 3 stars the Bay PD throws up roadblocks.
- **Three story missions** — a package run, a stolen sports car, and a heat escape, with dialogue and cash rewards.
- **Neon-package side job** — five glowing packages hidden around the city, $100 each plus a $500 bonus for the full set.
- **Combat** — hitscan shooting with tracers; wrecked patrol cars drop cash.
- **GTA-style HUD** — live minimap radar, wanted stars, money, health and armour, district names, a clock, a screen-edge arrow pointing at the objective, and a synth radio with song titles.
- **Save / continue** — autosaves every 20 seconds, or press G; the best score is kept.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| F | Enter / exit car |
| Mouse drag | Orbit camera |
| Click / J | Shoot |
| Space | Drift (handbrake) |
| H | Horn |
| R | Next radio station |
| G | Save |
| P / Esc | Pause |

---

<sub>Entered on [make.fun](https://make.fun/?ref=6fx127g4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
