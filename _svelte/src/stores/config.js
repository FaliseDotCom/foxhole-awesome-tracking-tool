// urls
const base = 'https://fatt.fali.se/',
      assets = base + 'assets/',
      icons = assets + 'icons/',
      maps = assets + 'maps/',
      api = base + 'api.php';

const urls = { base, assets, icons, maps, api }

// log to console?
const log = {
  hex: true,   // log hex changes 
  area: true,  // log area changes
  icon : true, // log icon changes
  zoom: false   // log (pan)zoom changes
}

// enabled or disabled tools
const tools = {
  points: true  // points tool
}

export const config = { 
  urls,
  log,
  tools,
  // update interval in seconds
  updates: 10
}