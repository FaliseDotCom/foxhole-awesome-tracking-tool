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
  to zoom, numpad 5 to recentre). Buttons at the bottom on the logo's side do the same:
  arrows, a zoom slider, and one that shows the whole map (hidden on narrow screens, which pan
  and zoom by touch). The map opens showing the whole map, or the view in the link, which a
  reload keeps.
- Zoomed out, hovering a hex shows its structures per team, its casualties in the last hour
  and day, and its three latest war log entries.
- Shows, bottom centre, the war number, the day of the war, the players in the game
  (from Steam), rocket sites (armed ones in red), storm cannons and intel centres per team,
  and the victory towns held per team against the number needed (lowered by one for every
  scorched victory town). Hover a counter for where they are.
- Shows a tooltip when you hover over a structure: type, team, state, and the nearest named
  place, such as "Town Base Tier 3 · Wardens · Victory town / The Spine, Dead Lands", and from
  the war log since when it is held or scorched: "Built by Wardens on 12 Nov, 09:40", "Taken by
  Colonials on 17 Nov, 16:14" or "Scorched on 17 Nov, 16:14" (left out for structures that did
  not change since the recording of the war started).
- Searches hexes, regions, locations, and structures from the field at the top (`/` jumps to
  it). Structures are listed as "type – nearest place", so "hosp dead" finds the hospitals in
  Dead Lands. Choosing a result brings it on screen and marks it briefly. The last five choices
  show when the field is empty.
- Plans routes over the roads in the Route tab (see below) and draws them on the map: the road
  in the route colour, orange through contested and red through enemy territory, dashed lines
  from each place to its road, and a lettered marker per place (A, the stops, B).
- Keeps the current shard and view in the address bar (`#able/3109/3108/0.80`: shard, map
  point at the screen centre, zoom), so a link opens the same view.
- Has tabs at the top right, with only their icons on phones:
  - **Log** — the war log, open by default on wide screens: captures, losses, upgrades,
    scorched towns, structures built or destroyed, construction started and finished, and
    victory town totals. The server records it, so it is the same for everyone and goes back
    to the start of the war for major events (victory towns, relics, rockets). Search it as
    you type, back to the start of the war, click an entry to go there, or show the map as it was right after it happened.
    A status line ("Live · checked 5 s ago · last change 12 min ago") shows it is working
    during quiet spells.
  - **Stats** — players in the game, viewers of F.A.T.T., casualties per hour, and the hexes
    with the most fighting in the last hour, over the whole war, the last 7 days, 24 hours,
    8 or 4 hours. The charts share one time axis: hovering one marks that moment in all of
    them.
  - **Route** — a route planner over the road network. Choose your team (Wardens or
    Colonials) first; then a start, stops and a destination with the same search as the map
    search, or by clicking the map. Stops can be added, removed and moved. **Shortest** takes
    the shortest road; **Safest** (the default) weighs every km by its territory, so it keeps
    to friendly ground. Options: through contested territory (hexes with casualties in the
    last hour; on), through enemy territory (off), avoid neutral regions and avoid scorched
    regions (both off); a place in such territory switches its option by itself and says so.
    Shows the distance in km, per leg too, and a fuel estimate for a speed class of logistics
    vehicles, on the high side; or why there is no route. The team, route kind, options and
    vehicle class are remembered in the browser. See
    [the plan](.docs/plans/2026-11-25-route-planner.md).
  - **Legend** — region colours, team colours, and every structure type on the map with its
    in-game name.
  - **Settings** — icon brightness, hex shading (fighting in the last hour, or changes in the
    last 6 hours), colour-blind team colours (blue and orange), region colour strength, icon
    size, hex names, the road network, the tabs on the right or the left, rocket trajectories,
    sound, and whether
    your visits are counted. Remembered in the browser.
  - **Shard** — switch between live shards. Since May 2026 Foxhole runs a single shard, so
    this tab is hidden until there is more than one.
- Draws a rocket counting down (its target is public for about a day before the launch) as a
  dashed arc from the armed rocket site to a dashed ring at the target.
- Draws rocket launches as an arc from the launch site to the impact, for every rocket of the
  war; Settings can hide these trajectories. A launch seen live sets
  off an air raid siren, a flashing beacon and a rumble; the impact a flash, a shockwave, an
  explosion and a quake. Sound can be turned off in Settings; "reduce motion" turns off the
  shaking and flashing.
- Shows a message when no shard is online or the war data cannot be loaded.
- Reloads itself shortly after a new version goes online, keeping the view and settings.
- Counts visitors without cookies, and with Do Not Track only when they opt in; see
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
| `GET /api/log/<shard>` | War log events. `?limit=` (at most 1000), `?since=<id>` and `?before=<id>` page through them; `&major=1` adds older major events. Also says when the scheduled task last ran. |
| `GET /api/history/<shard>?at=<ms>` | The map items of every hex as they were at that moment, like `/api/data`. |
| `GET /api/structures/<shard>/<hex>?at=<ms>` | Since when each structure in a hex is held by its team (built or taken) and since when it is scorched, from the war log; now, or at a moment of the war. |
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

### The road network

`assets/data/roads.json` is the road network of the whole map as one graph in map pixels, for
the route planner, which loads it when the Route tab first opens. It is traced from the hex images by `.scripts/roads/extract-roads.py` (Python;
install `.scripts/roads/requirements.txt`, then run the script; the usage is at its top), in
about 5 minutes. Three rules fill in what the images do not show by themselves: bridges are
always roads, towns are never dead ends (road ends in a town are led on through it), and
roads that touch are joined (junctions the tracing went round).
Corrections by hand go in `.scripts/roads/corrections.json`, which the script merges. Run it
again after the hex images change; its unit tests run with
`python -m unittest discover -s .scripts/roads -p "test_*.py"`. The method, the quality per hex and the
known gaps are in
[.docs/research/2026-11-25-road-extraction.md](.docs/research/2026-11-25-road-extraction.md).

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
the curl and pdo_sqlite extensions and write access to `.api/` and the web root.

Every push to master runs the Deploy workflow: it lints, builds the app, installs the PHP
dependencies, runs the unit tests, and commits the finished site to the `production` branch.
That branch is the web root as it should be on the server, including `.api/vendor/`, without
the source and tooling folders. Point the server's git deploy at `production`; it needs no
Node.js or Composer.

The runtime folders `.api/data/` (the war log database), `.api/cache/`, `.logs/`, and the
settings in `.api/.env` exist only on the server. The `.gitignore` in `production` lists them,
so a deploy leaves them alone; check that once on a new server before relying on it.

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
Control, the box "Count my visits" in the Settings tab starts unticked and nothing is sent
until the visitor ticks it; otherwise it starts ticked and unticking it stops counting. The
choice is remembered in the browser, and the Settings tab explains this.

The viewers in the Stats tab do not come from Matomo. While a map is open and visible, its
requests for map data carry a random id, kept in the browser so that reloads and other tabs
count once, and replaced after 5 minutes unused. The server counts the ids it saw in the last
5 minutes and then forgets them.

## Repository layout

| Path | Contents |
| --- | --- |
| `index.html`, `_app/` | The built app, published by `npm run build`. Do not edit by hand. |
| `assets/` | Map images, icons, fonts, stylesheets, and the road network (`assets/data/`). |
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

The Python road extraction in `.scripts/roads/` has no skill of its own; it follows the general
formatting rules.
