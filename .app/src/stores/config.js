import { dev } from '$app/env';

// urls
// relative to the site root, where the app, assets/ and api/ are served side by side
const base = '/',
      assets = base + 'assets/',
      icons = assets + 'icons/',
      icon_type = 'brighter',
      maps = assets + 'maps/',
      map_type = 'color',
      api = base + 'api/';

const urls = { 
  base, 
  assets, 
  icons: icons + icon_type + '/', 
  maps: maps + map_type + '/',  
  api 
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
  log,
  tools,
  // update interval in seconds
  updates: 10
}