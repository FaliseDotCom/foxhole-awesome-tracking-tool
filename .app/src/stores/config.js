import { dev } from '$app/env';

// urls
// relative to the site root, where the app, assets/ and api/ are served side by side
const base = '/',
      assets = base + 'assets/',
      api = base + 'api/';

/**
 * Query added to map tile and icon urls, so browsers load them again when they change: a hash
 * of their content, made at build time in vite.config.js.
 * @type {string}
 */
const assets_query = import.meta.env.ASSETS_VERSION ? `?v=${ import.meta.env.ASSETS_VERSION }` : '';

// icon and map folders; the style subfolder comes from the settings store
const urls = {
  base,
  assets,
  icons: assets + 'icons/',
  maps: assets + 'maps/',
  api
}

/**
 * Available styles per asset type, each a subfolder of its url above; the first is the default.
 * The `color` map style (assets/maps/color) is left out: its tiles are from 2022, outdated for
 * many hexes and missing for 16, so it mixed old and new terrain. A saved `color` setting is
 * no longer valid and falls back to `classic`.
 * @type {{ icons: string[], maps: string[] }}
 */
const styles = {
  icons: [ 'brighter', 'superbright', 'bright', 'default' ],
  maps: [ 'classic' ]
}

// enabled or disabled tools
const tools = {
  points : false
}

// log to console?
const log = {
  api     : false, // log API stuff
  data    : false, // log data changes in data component
  dynamic : false, // log changes in dynamic compoment
  area    : false, // log area changes
  icon    : false, // log icon changes
  zoom    : false, // log (pan)zoom changes
  summary  : false // log summary changes
}

// don't log if points tool is enabled or we're not in dev mode
if ( tools.points || !dev )  Object.keys( log ).forEach( key => log[ key ] = false )

// points tool is only allowed in dev mode
if ( !dev ) tools.points = false

export const config = {
  urls,
  assetsQuery: assets_query,
  styles,
  log,
  tools,
  // update interval in seconds
  updates: 10
}