# F.A.T.T. — Foxhole interactive war map

F.A.T.T. is an interactive, live-updating map of the current war in [Foxhole](https://www.foxholegame.com/).
It shows every hex of the world map, the regions inside each hex, and the structures on them,
coloured by the faction that holds them, and it refreshes from the official
[Foxhole War API](https://github.com/clapfoot/warapi) every few seconds.

Live at <https://fatt.fali.se/>. Source at
<https://github.com/FaliseDotCom/foxhole-awesome-tracking-tool>.

## The name

F.A.T.T. has no single expansion. The logo picks one of these at random on each page load:

- Foxhole Artillery Targeting Tool
- Foxhole Analytics Tracking Tool
- Foxhole Artillery THE Tool
- Foxhole Analytics THE Tool
- Foxhole Analytics Tracking Thing
- Foxhole Artillery Targeting Thing
- Foxhole Awesome Tracking Thing
- Foxhole Awesome Tracking Tool

The list lives in `.app/src/components/logo.svelte`.

## What it does

- Renders the whole world as one large SVG of hexagons, each with its background map image,
  border, and region polygons.
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
  to zoom, numpad 5 to recentre), and remembers the last view in `localStorage`.
- Lets you switch between the shards (servers) that are live, in the top-right corner.

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

The repository root is the web root, because the host cannot point it anywhere else. Source,
configuration, and runtime data live in dot folders, and `.htaccess` answers 404 for every
dot path (except `.well-known/`) and for `README.md` and `LICENSE`. It also rewrites
`/api/<route>` to `.api/index.php` and sends every other unknown path to `index.html`.
`.api/router.php` applies the same rules for the PHP development server; keep the two in step.

### Backend (`.api/`, PHP)

| File | Purpose |
| --- | --- |
| `index.php` | Front controller. `GET /api/shards` lists the live shards; `GET /api/data/<shard>` returns compressed dynamic data for every hex. A shard that is down or unknown answers `502` with a JSON error. |
| `router.php` | Router for `php -S`, mirroring `.htaccess`. |
| `bootstrap.php` | Error logging to `logs/` (never to the response), Composer autoloader, library includes. |
| `config.php` | Directory constants (`LOG_DIR`, `CACHE_DIR`). |
| `lib/api-foxhole.php` | `FoxholeApi`: War API client. `get_shards()` checks which documented shard roots answer `worldconquest/war` (the API has no endpoint that lists shards) and caches the result for 5 minutes. `async_dynamics()` fetches `worldconquest/maps/{hex}/dynamic/public` for all hexes in parallel and compresses each item to `{ x, y, t, i, f }` (coordinates rounded to 5 decimals, team as one letter, icon type, flags). |
| `lib/cache.php` | `Cache`: thin wrapper around `inouet/file-cache` writing to `cache/`. |
| `lib/grid.php`, `lib/icons.php`, `lib/point-location.php` | Leftovers from the earlier server-rendered version; not used. |
| `composer.json`, `vendor/` | PHP dependencies; `vendor/` is not committed. |
| `cache/`, `logs/` | Runtime output, created on first use and not committed. |

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
| `config.js` | Site-relative URLs for `/assets/` and `/api/`, icon and map image sets, per-topic console logging switches, the dev-only points tool, update interval. |
| `shards.js` | The live shards, loaded from `/api/shards`, and the selected one (the first live shard by default). |
| `world.js` | Polls `/api/data/<shard>` and publishes the dynamic data, adding a stable `key` to each item. Restarts on shard change. |
| `world_data.json` | Static, hand-built geometry for every hex: grid column/row, named points, region polygons built from those points, and label positions. |
| `grid.js` | Hex layout maths (1024 × 888 px hexes on a staggered grid), polygon helpers, and cached point-in-polygon tests that assign map items to regions. |
| `icons.js` | War API icon type IDs, resource types, flag bits, and the icon file name and CSS class for an item. |
| `visible.js` | Which grid rows and columns are on screen for the current pan/zoom. |
| `zoom.js` | Current zoom level and its limits. |

**Components** (`src/components/`)

- `map/layer-map.svelte` composes the map: `Scaler` → `PanZoom` → `SvgMap` → a stack of
  `Layer`s (backgrounds, areas, borders, summaries, dynamics, major and minor labels, and the
  dev points tool). Each `Layer` renders one hex component per hex.
- `map/hex/*.svelte` are the per-hex layers. `base.svelte` positions a hex and hides it when
  off screen; `data.svelte` subscribes it to the world store; `areas.svelte`,
  `dynamic.svelte`, and `summary.svelte` build on that.
- `panzoom.svelte` wraps the `panzoom` library and adds keyboard controls and view
  persistence.
- `shard.svelte`, `logo.svelte`, and `zoom.svelte` are the on-screen controls.

### Assets

`assets/` holds the map backgrounds (`maps/color`, `maps/classic`, WebP with PNG originals),
icon sets in four brightness levels (`icons/default`, `bright`, `brighter`, `superbright`),
fonts, stylesheets (`css/`), and the page background. They are served as they are and are
not part of the app build.

The map images and icons come from Foxhole and belong to Siege Camp; the fonts belong to
their designers. They are not covered by this project's licence (see [Licence](#licence)).

### Adding or fixing a hex

Region geometry is not available from the War API, so it is drawn by hand. Enable
`tools.points` in `src/stores/config.js` (dev mode only), then click on a hex to place lettered
points, and copy the result into the hex's `points` and `areas` in `world_data.json`. Label
positions come from the War API's `worldconquest/maps/{hex}/static` endpoint
(`mapTextItems`).

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
npm test          # Playwright smoke tests in src/tests, against the PHP server
```

Set `FATT_SERVER=https://fatt.fali.se` to develop against the live site instead of a local
PHP server. The tests need a browser once (`npx playwright install chromium`) and load live
War API data, so they fail when the War API is down. PHP needs a CA bundle
(`curl.cainfo` in `php.ini`) to reach the War API over HTTPS.

## Deploying

The whole repository is the site. Run `npm run build` in `.app/` and commit the published
`index.html` and `_app/` with your change, so the server needs neither Node.js nor a build
step. On the server: pull the repository, run `composer install --no-dev` in `.api/`, and
make sure PHP can create and write `.api/cache/` and `.api/logs/`. Apache needs
`mod_rewrite` and must allow `.htaccess` overrides.

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
