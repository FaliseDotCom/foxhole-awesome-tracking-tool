# F.A.T.T. — Foxhole interactive war map

F.A.T.T. is an interactive, live-updating map of the current war in [Foxhole](https://www.foxholegame.com/).
It shows every hex of the world map, the regions inside each hex, and the structures on them,
coloured by the faction that holds them, and it refreshes from the official
[Foxhole War API](https://github.com/clapfoot/warapi) every few seconds.

Live at <https://fatt.fali.se/>. Source at
<https://github.com/FaliseDotCom/foxhole-awesome-tracking-tool>.

## The name

F.A.T.T. can stand for any of the following:

- Foxhole Artillery Targeting Tool
- Foxhole Analytics Tracking Tool
- Foxhole Artillery THE Tool
- Foxhole Analytics THE Tool
- Foxhole Analytics Tracking Thing
- Foxhole Artillery Targeting Thing
- Foxhole Awesome Tracking Thing
- Foxhole Awesome Tracking Tool

## What it does

- Renders the whole world, all 53 hexes, with their background maps, borders, and regions.
- Refreshes every 10 seconds and draws all public map items — town halls, relic bases, keeps,
  factories, mines, rocket sites, and so on — with a Warden, Colonial, neutral, or scorched
  icon.
- Colours each region by the team that holds its town or relic base, and marks scorched
  regions.
- Flashes a hex or region when it changes.
- Shows more detail the further you zoom in: victory bases, rocket sites, and scorched items
  when zoomed out, then every map item, then region labels, then minor labels.
- Supports mouse, touch, and keyboard pan and zoom (arrows / WASD / numpad to pan, `+` / `-`
  to zoom, numpad 5 to recentre), and remembers the last view. Buttons at the bottom on the
  logo's side do the same: arrows, a zoom slider, and one that shows the whole map (hidden on
  narrow screens, which pan and zoom by touch).
- Zoomed out, hovering a hex shows its structures per team, its casualties in the last hour
  and day, and its three latest war log entries.
- Shows, bottom centre, the war number, the day of the war, the players in the game
  (from Steam), rocket sites (armed ones in red), storm cannons and intel centres per team,
  and the victory towns held per team against the number needed (lowered by one for every
  scorched victory town). Hover a counter for where they are.
- Shows a tooltip when you hover over a structure: type, team, state, and the nearest named
  place, such as "Town Base Tier 3 · Wardens · Victory town / The Spine, Dead Lands".
- Searches hexes, regions, locations, and structures from the field at the top (`/` jumps to
  it). Structures are listed as "type – nearest place", so "hosp dead" finds the hospitals in
  Dead Lands. Choosing a result brings it on screen and marks it briefly. The last five choices
  show when the field is empty.
- Keeps the current shard and view in the address bar (`#able/3109/3108/0.80`: shard, map
  point at the screen centre, zoom), so a link opens the same view.
- Has tabs at the top right, with only their icons on phones:
  - **Log** — the war log, open by default on wide screens: captures, losses, upgrades,
    scorched towns, structures built or destroyed, construction started and finished, and
    victory town totals. The server records it, so it is the same for everyone and goes back
    to the start of the war for major events (victory towns, relics, rockets). Filter it as
    you type, click an entry to go there, or show the map as it was right after it happened.
    A status line ("Live · checked 5 s ago · last change 12 min ago") shows it is working
    during quiet spells.
  - **Stats** — players in the game, viewers of F.A.T.T., casualties per hour, and the hexes
    with the most fighting in the last hour, over the whole war, the last 7 days, 24 hours,
    8 or 4 hours. The charts share one time axis: hovering one marks that moment in all of
    them.
  - **Legend** — region colours, team colours, and every structure type on the map with its
    in-game name.
  - **Settings** — icon brightness, hex shading (fighting in the last hour, or changes in the
    last 6 hours), colour-blind team colours (blue and orange), region colour strength, icon
    size, hex names, the tabs on the right or the left, sound, and whether your visits are
    counted. Remembered in the browser.
  - **Shard** — switch between live shards. Since May 2026 Foxhole runs a single shard, so
    this tab is hidden until there is more than one.
- Draws rocket launches as an arc from the launch site to the impact. A launch seen live sets
  off an air raid siren, a flashing beacon and a rumble; the impact a flash, a shockwave, an
  explosion and a quake. Sound can be turned off in Settings; "reduce motion" turns off the
  shaking and flashing.
- Shows a message when no shard is online or the war data cannot be loaded.
- Counts visitors without cookies and never with Do Not Track; see
  [Visitor statistics](#visitor-statistics).

## How it is built

```
Browser (SvelteKit single-page app)
   │  /api/…
   ▼
PHP API ── scheduled every 15 s: war log, history, statistics (SQLite)
   │  parallel requests, short file cache
   ▼
Foxhole War API
```

- **The app** (`.app/`) is a SvelteKit single-page app, built with `adapter-static`. The map
  is one large SVG of hexagons; only the hexes on screen are rendered.
- **The API** (`.api/`) is a small PHP application served at `/api/`. It fetches the War API
  for all hexes in parallel, compresses the result, and caches it. A scheduled task records
  the war log, the map history and the statistics in SQLite, so visitors cause no War API
  requests of their own.
- **Assets** (`assets/`) — map images, icons, fonts, and stylesheets — are served as they are
  and are not part of the app build.

Source, configuration, and runtime data live in dot folders, which are never served.

### API

Every route answers JSON. A shard that is down or unknown answers `502` with an error.

| Route | Returns |
| --- | --- |
| `GET /api/shards` | The live shards. |
| `GET /api/data/<shard>` | The current map items of every hex, compressed (see below). |
| `GET /api/war/<shard>` | The war number, start time, winner, and victory towns needed. |
| `GET /api/log/<shard>` | War log events. `?limit=`, `?since=<id>` and `?before=<id>` page through them; `&major=1` adds older major events. Also says when the scheduled task last ran. |
| `GET /api/history/<shard>?at=<ms>` | The map items of every hex as they were at that moment, like `/api/data`. |
| `GET /api/stats/<shard>?hours=24` | Casualties over time and per hex, when each hex last changed, and players and viewers over time. `?hours=war` covers the whole war. |
| `GET /api/players` | The last player count from Steam. |
| `GET /api/analytics` | Where the browser sends visitor statistics; `[]` when that is off. |
| `GET /api/health` | Whether the scheduled task runs, and the War API changes of the last 30 days (new hexes, icon types or map flags, hexes gone). |
| `GET /api/cron` | Runs the scheduled tasks; see [Hosting it](#hosting-it). |

The compressed map data per hex looks like:

```json
{
  "DeadLands": { "i": 3, "s": 0, "l": 1730000000000, "v": 212,
                 "d": [ { "x": 0.51, "y": 0.43, "t": "W", "i": 45, "f": 41 } ] }
}
```

Each item has its position in the hex (`x`, `y`), its team as one letter (`t`), its War API
icon type (`i`), and its War API flags (`f`).

### Adding or fixing a hex

`node scripts/build-hexes.js` (in `.app/`, add `--dry-run` to only report) rebuilds the hex
geometry and the background images from the War API: region ids, region names, label
positions, and the official images. Grid positions are in the script's `LAYOUT` table; add a
row when Foxhole adds a hex.

Region outlines are not in the API. The script keeps an outline when a hex still has exactly
the same regions, and otherwise generates approximate ones from the region labels. Correct
them with the points tool: enable `tools.points` in `src/stores/config.js` (development
only), click on a hex to place lettered points, and copy the result into the hex's `points`
and `areas` in `src/stores/world_data.json`. The script keeps corrected outlines on later
runs.

### Adding map icons

`assets/icons/` holds every icon in four brightness levels, each in a neutral, `Warden`,
`Colonial`, and `Scorched` version, named after the icon's name in `src/stores/icons.js`
without spaces. The official source images are the `.TGA` files in the War API repository
(`Images/MapIcons`).

## Running it

Requirements: PHP 8.4 with Composer and the curl and pdo_sqlite extensions, and Node.js 22.17
or newer with npm.

```bash
# backend dependencies
cd .api
composer install

# frontend, from .app/
cd ../.app
npm install
npm run api       # PHP development server: the site, /api, and /assets
npm run dev       # Vite dev server, using the PHP development server for /api and /assets
npm run build     # build, then publish index.html and _app/ to the web root
npm run lint      # ESLint
npm test          # unit tests, then browser tests against the PHP server
```

Set `FATT_SERVER` to the address of a running F.A.T.T. to develop against it instead of a
local PHP server. The browser tests need a browser once (`npx playwright install chromium`)
and load live War API data, so they fail when the War API is down.

## Hosting it

F.A.T.T. needs a web server that applies the rewrite rules in `.htaccess`, and PHP 8.4 with
the curl and pdo_sqlite extensions and write access to `.api/` and the web root. Build the app
with `npm run build` and serve the repository root without the source and tooling folders.

Request `/api/cron` every 15 seconds to record the war log, the map history, and the
statistics. Without it the war log is still recorded, but only while someone has the page open.

Server settings go in `.api/.env`; `.api/.env.example` lists them. They are only needed for
visitor statistics.

## Visitor statistics

F.A.T.T. can count visits with [Matomo](https://matomo.org/), when the server settings name
one; without them nothing is tracked. It sends:

- one page view per visit, without the view in the address;
- a ping every minute while the page is visible, so a map left open counts as active;
- the tabs opened, the settings changed, the history shown, and the controls clicked;
- the words of a search, only when a result is chosen.

The tracker runs without cookies. When the browser sends Do Not Track or Global Privacy
Control, or the visitor unticks "Count my visits" in the Settings tab, nothing is sent; with
Do Not Track or Global Privacy Control the box cannot be ticked. The Settings tab explains
this.

## Repository layout

| Path | Contents |
| --- | --- |
| `index.html`, `_app/` | The built app, published by `npm run build`. Do not edit by hand. |
| `assets/` | Map images, icons, fonts, and stylesheets. |
| `.app/` | The app source (SvelteKit). |
| `.api/` | The API (PHP). |
| `.docs/` | Project notes; reference links are in [.docs/links.md](.docs/links.md). |
| `.scripts/` | Development tooling. |

## Contributing

Contributions are welcome. See [.docs/CONTRIBUTING.md](.docs/CONTRIBUTING.md).

## Licence

The source code is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE): you may use, change, and share it for any
noncommercial purpose, but not to make money.

This does not cover the Foxhole map images and icons in `assets/`, which belong to Siege
Camp, or the fonts, which belong to their designers. Foxhole is a trademark of Siege Camp,
and this project is not affiliated with or endorsed by them.

## AI coding guidelines

Load these skills before changing code in this project:

- `php` — the API in `.api/`.
- `javascript` — stores and helpers in `.app/src/stores` and `.app/src/lib`, and `.app/scripts`.
- `svelte` — components in `.app/src/components` and `.app/src/routes`.
- `css` — stylesheets in `assets/css` and component `<style>` blocks.
