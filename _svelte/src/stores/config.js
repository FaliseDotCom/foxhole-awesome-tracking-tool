import { dev } from '$app/environment';

// urls
const base = 'https://fatt.fali.se/',
      assets = base + 'assets/',
      icons = assets + 'icons/',
      maps = assets + 'maps/',
      api = base + 'api.php';

const urls = { base, assets, icons, maps, api }

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
  zoom    : false // log (pan)zoom changes
}

// don't log if points tool is enabled or we're not in dev mode
if ( tools.points || !dev )  Object.keys( log ).forEach( key => log[ key ] = false )

// points tool is only allowed in dev mode
if ( !dev ) tools.points = false

export const config = { 
  urls,
  log,
  tools,
  // update interval in seconds
  updates: 10
}