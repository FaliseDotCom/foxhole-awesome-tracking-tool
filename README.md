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

- Renders the whole world, all 53 hexes, as one large SVG of hexagons, each with its
  background map image, border, and region polygons.
- Polls the War API (through a small PHP proxy) every 10 seconds and draws all public map
  items — town halls, relic bases, keeps, factories, mines, rocket sites, and so on — with
  a Warden, Colonial, neutral, or scorched icon.
- Colours each region by the team that holds its town or relic base, and marks scorched
  regions.
- Flashes a hex or region when its data changes between polls.
- Changes the level of detail with zoom:
  - below 0.4× — a summary layer with only victory bases, rocket sites, and scorched items;
  - 0.4× and up — every map item;
  - 0.6× and up — major (region) labels;
  - 0.8× and up — minor labels.
- Only renders hexes that are on screen.
- Supports mouse, touch, and keyboard pan and zoom (arrows / WASD / numpad to pan, `+` / `-`
  to zoom, numpad 5 to recentre), and remembers the last view.
- Lets you switch between live shards in the Shard tab at the top right. Since May 2026 Foxhole runs a
  single shard, so the picker is hidden until there is more than one.
- Shows the war number, the day of the war, and victory towns held per team against the
  number needed (lowered by one for every scorched victory town), bottom left.
- Shows a tooltip when you hover over a structure: type, team, state, and the nearest named
  place, such as "Town Base Tier 3 · Wardens · Victory town / The Spine, Dead Lands".
- Has a legend (region colours, team colours, and every structure type on the map with its
  in-game name) and settings (icon brightness, map style) in tabs at the top right;
  settings are remembered in the browser.
- Keeps the current shard and view in the address bar (`#able/3109/3108/0.80`: shard, map
  point at the screen centre, zoom), so a link opens the same view. Without a link it
  restores the last view from `localStorage`.
- Keeps a war log (the first tab at the top right, open by default on wide screens): captures, losses, upgrades, scorched towns, structures built
  or destroyed, and victory town totals; click an entry to go there. A status line ("Live · checked
  5 s ago · last change 12 min ago") shows the log is working during quiet spells. The server records it
  (`.api/data/warlog.sqlite`), so it is the same for everyone and has history; when the server
  log does not answer, the browser shows the changes it sees itself. Major events (victory
  towns, relics, rockets) from the whole war are loaded too, not only the latest 100. See
  `.docs/plans/2026-10-07-war-log.md`.
- Draws rocket launches as an arc from the launch site to the impact, with one war log entry
  ("Wardens fired a rocket from … hit …"); see `.docs/plans/2026-10-07-rocket-arcs.md`. A
  launch seen live sets off an air raid siren, a flashing beacon on the launch site and a
  rumble; the impact a screen flash, a shockwave, an explosion and a quake (`stores/effects.js`,
  sounds made with Web Audio in `lib/sound.js`). Sound can be turned off in Settings;
  "reduce motion" turns off the shaking and flashing.
- Keeps the map point at the screen centre in place when the window is resized.
- Searches hexes, regions, locations, and structures from the field at the top (`/` jumps to
  it). Structures are listed as "type – nearest place", so "hosp dead" finds the hospitals in
  Dead Lands. Choosing a result fits a hex or region on screen, or zooms in on a location or
  structure, and marks it briefly. The last five choices show when the field is empty.
- Shows a message when no shard is online or the war data cannot be loaded.

## How it is built

```
Browser (SvelteKit static SPA)
   │  GET /api/shards once, then every 10 s: GET /api/data/<shard>
   ▼
.htaccess → .api/index.php → .api/lib/api-foxhole.php (FoxholeApi)
   │  parallel Guzzle requests, file cache (3 s per map, 24 h for the map list)
   ▼
Foxhole War API  https://war-service-live*.foxholeservices.com/api/
```

### Web root and routing

The repository root is the web root. Source,
configuration, and runtime data live in dot folders, and `.htaccess` answers 404 for every
dot path (except `.well-known/`) and for `README.md` and `LICENSE`. It also rewrites
`/api/<route>` to `.api/index.php` and sends every other unknown path to `index.html`.
`.api/router.php` applies the same rules for the PHP development server; keep the two in step.

### Backend (`.api/`, PHP)

| File | Purpose |
| --- | --- |
| `index.php` | Front controller. `GET /api/shards` lists the live shards; `GET /api/data/<shard>` returns compressed dynamic data for every hex; `GET /api/war/<shard>` returns the war number, start time, winner, and victory towns needed (cached for a minute); `GET /api/log/<shard>` returns war log events (`?limit=`, `?since=<id>`, `?before=<id>`; `&major=1` adds older major events). Fresh `/api/data` is also handed to the war log recorder. A shard that is down or unknown answers `502` with a JSON error. |
| `router.php` | Router for `php -S`, mirroring `.htaccess`. |
| `bootstrap.php` | Error logging to `logs/` (never to the response), Composer autoloader, library includes. |
| `config.php` | Directory constants (`LOG_DIR`, `CACHE_DIR`). |
| `lib/api-foxhole.php` | `FoxholeApi`: War API client. `get_shards()` checks which documented shard roots answer `worldconquest/war` (the API has no endpoint that lists shards) and caches the result for 5 minutes. `async_dynamics()` fetches `worldconquest/maps/{hex}/dynamic/public` for all hexes in parallel and compresses each item to `{ x, y, t, i, f }` (coordinates rounded to 5 decimals, team as one letter, icon type, flags). |
| `lib/cache.php` | `Cache`: thin wrapper around `inouet/file-cache` writing to `cache/`. |
| `lib/grid.php`, `lib/icons.php`, `lib/point-location.php` | Leftovers from the earlier server-rendered version; not used. |
| `composer.json`, `vendor/` | PHP dependencies; `vendor/` is not committed. |
| `lib/warlog-*.php`, `lib/warlog.php` | Server-side war log: the comparison (a port of `.app/src/lib/warlog-diff.js`, tested with the same fixtures by `tests/warlog-diff-test.php`), the SQLite storage, and the recorder. |
| `cron/record.php` | Records the war log for every live shard; run every minute by a cron job. |
| `cache/`, `logs/`, `data/` | Runtime output, created on first use and not committed. `data/` holds the war log database: never overwrite or delete it when deploying. |

The compressed response per hex looks like:

```json
{
  "DeadLands": { "i": 3, "s": 0, "l": 1730000000000, "v": 212,
                 "d": [ { "x": 0.51, "y": 0.43, "t": "W", "i": 45, "f": 41 } ] }
}
```

### Frontend (`.app/`, SvelteKit + `adapter-static`)

Svelte 5 (components still use the legacy, non-runes syntax), SvelteKit 3, and Vite 8. Built
as a single-page app (`fallback: index.html`). SvelteKit 3 has no `svelte.config.js`: the
adapter and the path aliases `@components`, `@stores`, and `@lib` are all set in
`vite.config.js`.

**Stores** (`src/stores/`)

| Store | Purpose |
| --- | --- |
| `config.js` | Site-relative URLs for `/assets/` and `/api/`, the available icon and map styles, per-topic console logging switches, the dev-only points tool, update interval. |
| `shards.js` | The live shards, loaded from `/api/shards`, and the selected one (the first live shard by default). |
| `world.js` | Polls `/api/data/<shard>` and publishes the dynamic data, adding a stable `key` to each item. Restarts on shard change. |
| `world_data.json` | Static, hand-built geometry for every hex: grid column/row, named points, region polygons built from those points, and label positions. |
| `grid.js` | Hex layout maths (1024 × 888 px hexes on a staggered grid), polygon helpers, and cached point-in-polygon tests that assign map items to regions. |
| `icons.js` | War API icon type IDs, resource types, flag bits, and the icon file name and CSS class for an item. |
| `visible.js` | Which grid rows and columns are on screen for the current pan/zoom. |
| `zoom.js` | Current zoom level and its limits. |
| `settings.js` | Icon and map style chosen by the viewer, saved in `localStorage`. |
| `link.js` | Reads and writes the shareable link in the URL hash. |
| `war.js` | War state from `/api/war/<shard>` plus victory towns counted from the world store. |

**Components** (`src/components/`)

- `map/layer-map.svelte` composes the map: `Scaler` → `PanZoom` → `SvgMap` → a stack of
  `Layer`s (backgrounds, areas, borders, summaries, dynamics, major and minor labels, and the
  dev points tool). Each `Layer` renders one hex component per hex.
- `map/hex/*.svelte` are the per-hex layers. `base.svelte` positions a hex and hides it when
  off screen; `data.svelte` subscribes it to the world store; `areas.svelte`,
  `dynamic.svelte`, and `summary.svelte` build on that.
- `panzoom.svelte` wraps the `panzoom` library and adds keyboard controls and view
  persistence.
- `logo.svelte`, `search.svelte`, `war.svelte`, and `status.svelte` are the panels over the map, and `tabs.svelte` holds the tabs at the top right: `warlog.svelte`, `legend.svelte`, `settings.svelte`, and `shard.svelte` (only with more than one live shard). Their styles are in `assets/css/panels.css` and the per-feature files next to it.

### Assets

`assets/` holds the map backgrounds (`maps/classic`: the official War API images of all 53 hexes, the default; `maps/color`: a recoloured 2022 set of the original 37, falling back to `classic`),
icon sets in four brightness levels (`icons/default`, `bright`, `brighter`, `superbright`),
fonts, stylesheets (`css/`), and the page background. They are served as they are and are
not part of the app build.

The map images and icons come from Foxhole and belong to Siege Camp; the fonts belong to
their designers. They are not covered by this project's licence (see [Licence](#licence)).

### Adding or fixing a hex

`node scripts/build-hexes.js` (in `.app/`, add `--dry-run` to only report) rebuilds
`world_data.json` and `assets/maps/classic/` from the War API: region ids, region names, label
positions, and the official background images. Grid positions are in the script's `LAYOUT`
table; add a row when Foxhole adds a hex. Region outlines are not in the API: the script keeps
an outline when a hex still has exactly the same regions, and otherwise generates outlines (a
Voronoi diagram of the region labels). Generated outlines are approximate; correct them with
the points tool: enable `tools.points` in `src/stores/config.js` (dev mode only), click on a
hex to place lettered points, and copy the result into the hex's `points` and `areas`. The
script keeps corrected outlines on later runs.

### Adding map icons

`assets/icons/{default,bright,brighter,superbright}/` hold every icon in a neutral, `Warden`,
`Colonial`, and `Scorched` version, named after the icon's name in `icons.js` without spaces.
The official source images are the `.TGA` files in the War API repository
(`Images/MapIcons`). The icons for types 70–92 were generated from those by matching the
colours of the existing icon sets.

## Running it

Requirements: PHP 8.4 with Composer, and Node.js 22.17 or newer with npm.

```bash
# backend dependencies (vendor/ is not committed)
cd .api
composer install

# frontend, from .app/
cd ../.app
npm install
npm run api       # PHP development server on 127.0.0.1:8090: the site, /api, and /assets
npm run dev       # Vite dev server; forwards /api and /assets to the PHP server
npm run build     # build, then publish index.html and _app/ to the web root
npm run lint      # ESLint (flat config in eslint.config.js)
npm test          # unit tests (node --test, src/tests/*.unit.js), then Playwright tests against the PHP server
```

Set `FATT_SERVER=https://fatt.fali.se` to develop against the live site instead of a local
PHP server. The browser tests need a browser once (`npx playwright install chromium`) and
load live War API data, so they fail when the War API is down. They only run locally: run
`npm test` before every push. The deploy runs only the unit tests. PHP needs a CA bundle
(`curl.cainfo` in `php.ini`) to reach the War API over HTTPS.

## Deploying

The server (DirectAdmin) has no git or SSH, so GitHub Actions deploys over FTP:
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on every push to `master`
(or by hand from the Actions tab). It lints and builds the app, runs `composer install
--no-dev` for `.api/`, runs the unit tests (JavaScript and the PHP war log diff), and uploads
the served files; a failing step stops the upload. The browser tests are not part of it. Source and tooling (`.app/`, `.docs/`,
`.scripts/`, `README.md`, `LICENSE`) stay off the server. The first run uploads everything;
later runs upload only changed files, tracked in `.ftp-deploy-sync-state.json` on the server.

It needs four repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, and
`FTP_SERVER_DIR` (the web root of fatt.fali.se as the FTP account sees it, ending in `/`).

The server needs Apache with `mod_rewrite` and `.htaccess` overrides allowed, PHP with the
curl and pdo_sqlite extensions, and write access for PHP to `.api/`, where it creates
`cache/`, `logs/`, and `data/`.

For the war log, add a DirectAdmin cron job that runs every minute (`*` in all five time
fields) and records every live shard. Any of these commands works; pick the one that matches
how the other cron jobs on the server are set up. They can be pasted as they are: cron runs
them with `sh`, which reads `~` as the account's home folder (`/home/<user>`).

```
# run the script directly
/usr/local/php84/bin/php ~/domains/fatt.fali.se/public_html/.api/cron/record.php

# from its own folder, at low priority and without output (as the server's other PHP cron jobs)
cd ~/domains/fatt.fali.se/public_html/.api/cron; /bin/nice -n15 /usr/local/php84/bin/php -q record.php >/dev/null 2>&1

# keep a log of each run instead, to see what it recorded or why it failed
/usr/local/php84/bin/php ~/domains/fatt.fali.se/public_html/.api/cron/record.php >> ~/fatt-cron.log 2>&1
```

Use the PHP version the site runs on, not the system PHP: on this server `/usr/bin/php` is PHP
7.2, which cannot load the dependencies (the error log then shows "Composer detected issues in
your platform"). DirectAdmin installs each PHP version it offers as `/usr/local/phpXY/bin/php`,
here `/usr/local/php84/bin/php`; `/usr/local/bin/php` is its default version, which may differ
from the site's. A test cron job such as `/usr/local/php84/bin/php -v > ~/php.txt`
shows what a binary is. The script refuses web requests: opening it in a browser gives a 404.
Errors go to the API's daily error log, `.api/logs/error-YYYY-MM-DD.log`.

When the server cannot run PHP from cron, a web request can stand in. Requesting the map data
of a shard records that shard, just as a visitor would, so add one job per shard (`able`,
`baker`):

```
/usr/bin/wget -O /dev/null 'https://fatt.fali.se/api/data/<shard>' >/dev/null 2>&1
```

These recordings count as `request`, not `cron`, so `cronAt` stays 0 with this method.

Without any cron job the log is still recorded, but only while someone has the page open.

To check the cron job runs: `/api/log/<shard>` returns `cronAt` (when the cron job last ran,
0 if never) and `recordedBy` (`cron` or `request`, who made the last recording), and every
event has a `recordedBy` too. Hovering the war log status line shows the same in words.

Commit the published `index.html` and `_app/` after `npm run build` too; the workflow
rebuilds them anyway, but the committed copy keeps the repository a complete site.

## Repository layout

| Path | Contents |
| --- | --- |
| `index.html`, `_app/` | The built app, published by `npm run build`. Do not edit by hand. |
| `assets/` | Map images, icons, fonts, and stylesheets. |
| `favicon.png`, `.htaccess` | Served as they are. |
| `.app/` | The SvelteKit source. |
| `.api/` | The PHP API. |
| `.docs/` | Project notes; reference links are in [.docs/links.md](.docs/links.md). |
| `.scripts/` | Development tooling (PHPStan wrapper). |
| `.github/workflows/` | GitHub Actions: build and FTP deploy. |
| `.org/` | Original source material (ignored by git). |

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
