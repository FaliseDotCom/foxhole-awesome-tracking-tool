# Reference links

Checked on 7 October 2026. The Foxhole wiki blocks automated requests, so that link was not
checked; every other link answered.

## Foxhole War API

- [clapfoot/warapi](https://github.com/clapfoot/warapi) — the official War API documentation:
  shard root URLs, endpoints, icon type IDs, map flags, ETag caching. The source of truth for
  `.api/lib/api-foxhole.php` and `.app/src/stores/icons.js`.
- [Images/MapIcons](https://github.com/clapfoot/warapi/tree/master/Images/MapIcons) — official
  map icons as `.TGA`. Source of the icons in `assets/icons/`.
- [Images/Maps](https://github.com/clapfoot/warapi/tree/master/Images/Maps) — official hex
  background images for all current hexes, including the 16 that FATT does not draw yet, plus
  `BGOneWorldMap.TGA`. Source for new images in `assets/maps/`.
- Live endpoints to try in a browser:
  [war state](https://war-service-live.foxholeservices.com/api/worldconquest/war) and
  [hex list](https://war-service-live.foxholeservices.com/api/worldconquest/maps) on Able.
  Baker and Charlie use `war-service-live-2` and `war-service-live-3`.

## Foxhole community

- [Foxhole](https://www.foxholegame.com/) — official site, with patch notes and the
  [FAQ](https://www.foxholegame.com/faq).
- [Foxhole Wiki](https://foxhole.wiki.gg/) — structures, map locations, and update history; useful
  for naming new icon types.
- [foxholetools](https://github.com/foxholetools) — community repositories. `assets` (extracted
  game files, updated January 2026) is the most active; `arty`, `maps`, and `assets-scripts` have
  not changed since 2021–2023. The local `.org/assets` copy came from this organisation.
- [LogiWaze](https://www.logiwaze.com/) — logistics route planner on a live Foxhole map; a good
  comparison for map rendering and hex data.
- [Foxhole Stats](https://www.foxholestats.com/) — war statistics and history built on the War
  API.

## Frontend libraries

- [anvaka/panzoom](https://github.com/anvaka/panzoom) — pan and zoom used by
  `panzoom.svelte`. The README lists the options; the
  [source](https://github.com/anvaka/panzoom/blob/main/index.js) is the only full reference for
  methods like `zoomAbs`, `smoothZoom`, `moveBy`, and the `transform` event.
- [robust-point-in-polygon](https://github.com/mikolalysenko/robust-point-in-polygon) — hit test
  that assigns map items to regions in `grid.js`.
- [Svelte 5](https://svelte.dev/docs/svelte) and [SvelteKit](https://svelte.dev/docs/kit)
  documentation.
- [Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) — why the
  config lives in `vite.config.js` and `$app/env` replaced `$app/environment`.
- [adapter-static](https://svelte.dev/docs/kit/adapter-static) — single page app build and the
  `fallback` option.
- [Vite server proxy](https://vite.dev/config/server-options#server-proxy) — how `npm run dev`
  forwards `/api` and `/assets`.
- [eslint-plugin-svelte](https://sveltejs.github.io/eslint-plugin-svelte/) — lint rules, such as
  `svelte/require-each-key`.
- [Playwright](https://playwright.dev/docs/intro) — the browser tests in `.app/src/tests`.

## Backend and hosting

- [Guzzle](https://docs.guzzlephp.org/en/stable/) and
  [guzzle/promises](https://github.com/guzzle/promises) — HTTP client and the promise helpers
  (`Utils::unwrap`, `Utils::settle`) behind the parallel War API requests.
- [Apache mod_rewrite](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html) — the rules in
  `.htaccess`, including the `END` flag.

## Licence

- [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) — the
  project licence, also in `LICENSE`.
