// urls
const base = 'https://fatt.fali.se/',
      assets = base + 'assets/',
      icons = assets + 'icons/',
      maps = assets + 'maps/',
      api = base + 'api.php';

const urls = { base, assets, icons, maps, api }

// log to console?
const log = {
  hex: false,   // log hex changes 
  area: false,  // log area changes
  icon : false, // log icon changes
  zoom: false   // log (pan)zoom changes
}

// enabled or disabled tools
const tools = {
  points: true  // points tool
}

export const config = { 
  urls,
  log,
  tools
}