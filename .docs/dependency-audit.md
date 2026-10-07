# Dependency and API audit — 7 October 2026

The code was last changed in November 2022. This note records what has moved since then.

## Foxhole War API

Checked against the live API (war 141) and the `clapfoot/warapi` README.

| Change | Effect on F.A.T.T. |
| --- | --- |
| The world grew from 37 to 53 hexes. New: Clahstra, Gutter, Kings Cage, Kuura Strand, Lykos Isle, Olavis Wake, Onyx, Palantine Berm, Pari Peak, Pipers Enclave, Reavers Pass, Sableport, Stema Landing, Stlican Shelf, Tyrant Foothills, Wresta. | `world_data.json` has no grid position, regions, or labels for them, so they are not drawn. The backend still fetches their data. Map images for them are also missing from `assets/maps/`. |
| New icon types in live data: 75 Oil Rig, 84 Mortar House, 88 Aircraft Depot, 89 Aircraft Factory, 91/92 Aircraft Runway T1/T2, and 97 (undocumented). Documented but not seen today: 70–72 rocket states, 83 Weather Station, 90 Aircraft Radar. | **Fixed:** types 70–92 are in `icons.js`, with icons generated from the official TGAs. 83 has no artwork and is not drawn; 97 is still unknown and is logged once. |
| Flag bit `0x08` is set on many items (values 8 and 41 seen). It is not in the README. | Ignored by `getFlags()`; harmless, but unexplained. |
| Responses now include `mapItemsC`, `mapItemsW` (empty on the public endpoint), and `viewDirection` per item. | Not used; no change needed. |
| `war-service-live-2` and `-3` return 503; only `war-service-live` (Able) answers. | **Fixed:** Able is now the default shard, and a down shard returns a JSON 502 instead of a PHP error page. Baker and Charlie stay selectable for when they return. |
| ETags are still supported (`If-None-Match` → 304), `Cache-Control: max-age=3`. | The current backend does not send ETags on its live path; adding them would cut traffic. |

### Bug found while checking

The frontend shard names (`able`, `baker`, `charlie` in `_svelte/src/stores/shards.js`) do
not match the backend's (`able`, `baker`, `dev` in `lib/api-foxhole.php`). Selecting
"charlie" silently falls back to Able. **Fixed:** the backend now calls it `charlie` too.

## npm (`.app/package.json`, was `_svelte/package.json`)

**Done on 7 October 2026.** Upgraded to Svelte 5.57, SvelteKit 3.0, adapter-static 4, Vite 8,
ESLint 10 with `eslint-plugin-svelte` (flat config), and Playwright 1.63. The unused packages
below were removed, and so was Prettier: its formatting (braces on the same line) conflicts
with the project's code style. Code fixes: config moved from `svelte.config.js` into
`vite.config.js`, `$app/environment` → `$app/env`, `svelte/internal` → `svelte`, and
`{ #each }`-style block tags → `{#each}` (Svelte 5 rejects the space). `npm run lint` is clean:
unused code was removed (including the dead `lessNumbers()` and `rebuildJSON()` dev tools in
`grid.js` and the unused `svg/icons.svelte`) and every `{#each}` block has a key.

The table records the state before the upgrade.

Installed versions are pre-release SvelteKit 1.0 builds. Every major package is several
majors behind, and they have to move together.

| Package | Installed | Latest | Notes |
| --- | --- | --- | --- |
| `svelte` | 3.52.0 | 5.57.2 | Legacy (non-runes) components still compile in 5. Must change: `import { onMount } from 'svelte/internal'` in `areas.svelte` (private API, removed). Deprecated but working: `$$props`, `<slot>`, `<svelte:component>`, `afterUpdate`/`beforeUpdate`, `on:` directives. |
| `@sveltejs/kit` | 1.0.0-next.535 | 3.0.1 | Needs `@sveltejs/vite-plugin-svelte` as an explicit dev dependency since Kit 2. |
| `@sveltejs/adapter-static` | 1.0.0-next.48 | 4.0.0 | |
| `@sveltejs/adapter-auto` | 1.0.0-next.87 | 8.0.0 | Unused (static adapter is configured); remove. |
| `vite` | 3.2.2 | 8.3.3 | |
| `@playwright/test` | 1.27.1 | 1.63.0 | `tests/test.js` is the create-svelte placeholder. |
| `eslint` | 8.26.0 | 10.12.0 | v9+ needs a flat config (`eslint.config.js`) instead of `.eslintrc.cjs`. |
| `eslint-plugin-svelte3` | 4.0.0 | — | Deprecated; replace with `eslint-plugin-svelte` 3.x. |
| `eslint-config-prettier` | 8.5.0 | 10.1.8 | |
| `prettier` | 2.7.1 | 3.9.9 | v3 removed `--plugin-search-dir`; the `lint` and `format` scripts must drop it and list the plugin in `.prettierrc`. |
| `prettier-plugin-svelte` | 2.8.0 | 4.1.1 | |
| `sass` | 1.56.0 | 1.105.1 | No `.scss` files exist; probably removable. |
| `svelte-preprocess` | 4.10.7 | 6.0.5 | Not configured in `svelte.config.js`; probably removable. |
| `rollup-plugin-svelte` | 7.1.0 | 7.2.3 | Not used by Vite/Kit; remove. |
| `panzoom` | 9.4.3 | 9.4.4 | Patch release; API unchanged. |
| `robust-point-in-polygon` | 1.0.3 | 1.0.3 | Current. |
| `lodash`, `isomorphic-unfetch`, `f-etag` | — | — | Not imported anywhere; remove. |
| `src` (`file:./`) | — | — | Self-reference that npm reports as invalid; remove. |

`node_modules` also contains extraneous packages (axios and its dependencies) that are not
in `package.json`.

## Composer (project root)

| Package | Locked | Latest | Notes |
| --- | --- | --- | --- |
| `guzzlehttp/guzzle` | 7.5.0 | 8.2.0 (7.x: ≥ 7.15.2) | `composer audit` reports 9 advisories here (1 high: host-check bypass, fixed in 7.15.2) and 5 medium in `guzzlehttp/psr7` 2.4.1. Updating within 7.x with dependencies is a drop-in fix. |
| `kevinrob/guzzle-cache-middleware` | 4.0.1 | 8.0.0 | Imported but never used; remove. |
| `katzgrau/klogger` | dev-master | dev-master | Pins `psr/log` 1.x. Unmaintained; consider Monolog if `psr/log` 3 is needed. |
| `inouet/file-cache` | dev-master | dev-master | Unmaintained; check it runs on the server's PHP version before any PHP upgrade. |

## Other findings

- `api.php?clean` renamed and deleted files under `assets/` without authentication.
  **Removed** with the move to `.api/`.
- `config.php` defined `ALLOWED_IPS` and a plain-text `PASSWORD`, used only by an untracked
  log viewer in `logs/index.php`. **Removed** from `.api/config.php`; the password is still in
  git history, so change it wherever else it is used.

The live shard list is no longer hard-coded in the frontend: `/api/shards` returns only the
shards whose War API answers (the API itself has no shard list endpoint).

## Suggested order

1. ~~Update Guzzle within 7.x and drop the unused middleware.~~ Done: Guzzle 7.15.5, psr7 2.13.1,
   promises 2.5.3; `composer audit` is clean.
2. ~~Fix the shard name mismatch.~~ Done.
3. ~~Add the new icon types and their images.~~ Done.
4. ~~Upgrade the frontend toolchain in one go.~~ Done.
5. ~~Add the 16 new hexes and refresh the old ones.~~ Done, see `plans/2026-10-07-new-hexes.md`.
