import { dev } from '$app/environment';

// urls
const base = 'https://fatt.fali.se/',
      assets = base + 'assets/',
      icons = assets + 'icons/',
      maps = assets + 'maps/',
      api = base + 'api.php';

const urls = { base, assets, icons, maps, api }

// enable points tool
const points = false && dev;

// enabled or disabled tools
const tools = {
  points
}

// log to console?
const log = {
  hex: false && dev && !points,   // log hex changes 
  area: false && dev && !points,  // log area changes
  icon : false && dev && !points, // log icon changes
  zoom: false && dev && !points   // log (pan)zoom changes
}

export const config = { 
  urls,
  log,
  tools,
  // update interval in seconds
  updates: 10
}