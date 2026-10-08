import { config } from '@stores/config.js'

// icon id : filename
const list = {
  5 : "Static base 1",
  6 : "Static base 2",
  7 : "Static base 3",

  8 : "Forward base 1",
  9 : "Forward base 2",
  10 : "Forward base 3",

  11 : "Hospital",
  12 : "Vehicle",
  13 : "Armory",
  14 : "Supply Station",
  15 : "Workshop",
  16 : "Manufacturing Plant", 
  17 : "Refinery",
  18 : "Shipyard",
  19 : "Tech Center",

  20 : "Salvage",
  21 : "Components",
  22 : "Fuel field",
  23 : "Sulfur",
  24 : "World map tent",
  25 : "Travel tent",
  26 : "Training area",
  27 : 'Keep', // "Special Base",
  28 : "Observation Tower",
  29 : "Fort",
  30 : "Troop Ship",

  32 : "Sulfur Mine",
  33 : "Storage Facility",
  34 : "Factory",
  35 : 'Safehouse', // "Garrison Station",
  36 : "Ammo factory",
  37 : "Rocket Site",
  38 : "Salvage Mine",
  39 : "Construction Yard",
  40 : "Component Mine",
  41 : 'Oil Well',

  45 : "Relic Base", // 1
  46 : "Relic Base", // 2
  47 : "Relic Base", // 3

  51 : "Mass Production Factory",
  52 : "Seaport",
  53 : "Coastal Gun",
  54 : "Soul Factory",

  56 : "Town Base Tier 1",
  57 : "Town Base Tier 2",
  58 : "Town Base Tier 3",

  59 : "Storm Cannon",
  60 : "Intel Center",

  61 : "Coal Field",
  62 : "Oil Field",

  70 : "Rocket Target",
  71 : "Rocket Ground Zero",
  72 : "Rocket Site With Rocket",
  75 : "Oil Rig",
  83 : "Weather Station",
  84 : "Mortar House",

  88 : "Aircraft Depot",
  89 : "Aircraft Factory",
  90 : "Aircraft Radar",
  91 : "Aircraft Runway T1",
  92 : "Aircraft Runway T2"
};

/**
 * Other names players use for a structure type, shown in the legend and matched by search.
 * The names in `list` double as icon file names, so in-game or common names go here.
 * @type {Record<number, string[]>}
 */
const aliases = {
  11: [ 'Field Hospital' ],
  12: [ 'Garage', 'Vehicle Factory' ],
  20: [ 'Salvage Field' ],
  21: [ 'Component Field' ],
  23: [ 'Sulfur Field' ],
  27: [ 'Special Base' ],
  33: [ 'Storage Depot' ],
  35: [ 'Garrison Station' ],
  51: [ 'MPF' ],
  56: [ 'Town Hall' ],
  57: [ 'Town Hall' ],
  58: [ 'Town Hall' ],
  88: [ 'Airfield' ],
  89: [ 'Airfield' ],
  91: [ 'Airfield', 'Airstrip' ],
  92: [ 'Airfield', 'Airstrip' ]
};

/**
 * Icon ids the War API documents but has no artwork for; these are not drawn.
 * @type {number[]}
 */
const without_image = [ 83 ];

/**
 * Unknown icon ids that were already reported, so each is logged only once.
 * @type {Set<number>}
 */
const reported = new Set();

// list of resource ids
const resources = {
  41 : 'oil',
  62 : 'oil',
  23 : 'sulphur',
  32 : 'sulphur',
  61 : 'coal',
  20 : 'salvage',
  38 : 'salvage',
  21 : 'components',
  40 : 'components'
};

// bases that count agains region control
const region_bases = [
  // relic bases
  45, 46, 47,
  // town bases
  56, 57, 58,
];

// bases that count agains win conditions
const win_bases = [
  // relic bases
  45, 46, 47,
  // town bases
  56, 57, 58,
  // victory base?
];

// all bases
const bases = [
  // relic bases
  45, 46, 47,
  // town bases
  56, 57, 58,
  // keep
  27
];

// valid team names; key = input from api, value = filename
const teams = {
  'colonials': 'colonial', 
  'wardens' : 'warden',
  'c' : 'colonial',
  'w' : 'warden',
}

const ucFirst = word => word.charAt(0).toUpperCase() + word.toLowerCase().slice(1)

// get flags bits as object
const getFlags = f =>
{
  return {
    isVictoryBase : f & 0x01,
    isHomeBase    : f & 0x02,
    isBuildSite   : f & 0x04,
    isScorched    : f & 0x10,
    isTownClaimed : f & 0x20
  };
}

/**
 * Get the icon url for a map item.
 *
 * @param {object} d     Map item from the API ({ i, t, f }).
 * @param {string} style Icon style folder, one of config.styles.icons.
 * @returns {string} Icon url, or an empty string when there is no icon for this type.
 */
const getIcon = ( d, style = config.styles.icons[ 0 ] ) =>
{
  const id = 'i' in d ? d.i : 0,
        team = 't' in d ? d.t : '',
        flags = getFlags( 'f' in d ? d.f : 0 ),
        ext = 'png'; // considered webp icons but there's hardly any gain

  if ( without_image.includes( id ) ) return '';

  if  ( id && id in list )
  {
    let name = list[ id ].replaceAll( ' ', '' ) 

    if ( flags.isScorched )
    {
      name += 'Scorched';
    }
    else if ( isResource( id ) )
    {
      name += 'Color'
    }
    else if ( team && team.toLowerCase() in teams )
    {
      name += ucFirst( teams[ team.toLowerCase() ] )
    }

    return `${ config.urls.icons }${ style }/${ name }.${ ext }${ config.assetsQuery }`
  }
  else if ( !reported.has( id ) )
  {
    reported.add( id );
    console.warn( 'Unknown icon type ' + id );
  }
  return ''
}

// get css class for an icon
const getCss = d =>
{
  let css = 'icon';
  // the team, for recolouring Colonial icons with the colour-blind palette
  if ( d.t ) css += ` team-${ d.t }`;
  if ( isScorched( d ) ) css += ' scorched';
  if ( isVictoryBase( d ) ) css += ' victory';
  if ( isBuildSite( d ) ) css += ' build';
  return css;
}

// get name from ID
const getName = id => ( id in list ) ? list[ id ] : '';

/**
 * Other names of a structure type, for search.
 *
 * @param {number} id Icon type id.
 * @returns {string[]} Alternative names, or an empty array.
 */
const getAliases = id => aliases[ id ] || [];

/**
 * Team names by the one-letter team id the API proxy sends.
 * @type {Record<string, string>}
 */
const team_names = {
  W: 'Wardens',
  C: 'Colonials'
};

/**
 * Get the team name for a map item.
 *
 * @param {object} d Map item from the API ({ t }).
 * @returns {string} Wardens, Colonials, or an empty string for neutral items.
 */
const getTeam = d => team_names[ d.t ] || '';

/**
 * Get a short description of a map item for its tooltip, such as
 * "Town Base Tier 3 · Wardens · Victory town".
 *
 * @param {object} d Map item from the API ({ i, t, f }).
 * @returns {string} Name, team and state joined with dots.
 */
const getTitle = d =>
{
  const parts = [ getName( d.i ), getTeam( d ) ];
  if ( isVictoryBase( d ) ) parts.push( 'Victory town' );
  if ( isScorched( d ) ) parts.push( 'Scorched' );
  if ( isBuildSite( d ) ) parts.push( 'Build site' );
  return parts.filter( Boolean ).join( ' · ' );
};

// is this icon a resource?
const isResource = id => id in resources

// get resource name
const getResource = id => id in resources ? resources[ id ] : ''

// can an icon be conquered? basically not a resource
const isConquerable = id => !isResource( id )

// is id a base?
const isBase = id => bases.includes( id )

// is id a base that counts agains winning?
const isWinBase = id => win_bases.includes( id )

// is id a region base?
const isRegionBase = id => region_bases.includes( id )

// get region bases icon ids
const getRegionBases = () => region_bases

// get scorced state from flags
const isScorched = d => {
  const flags = getFlags( 'f' in d ? d.f : 0 )
  return flags.isScorched;
}

// get build site state from flags
const isBuildSite = d => {
  const flags = getFlags( 'f' in d ? d.f : 0 )
  return flags.isBuildSite;
}

// get victory base state from flags
const isVictoryBase = d => {
  const flags = getFlags( 'f' in d ? d.f : 0 )
  return flags.isVictoryBase;
}

// get town claimned state from flags
const isTownClaimed = d => {
  const flags = getFlags( 'f' in d ? d.f : 0 )
  return flags.isTownClaimed;
}

// check if icon is a rocket site
const isRocket = d => d.i === 37;

export const icons = {
  list,
  getIcon,
  getName,
  getAliases,
  getTeam,
  getTitle,
  isResource,
  getResource,
  isConquerable,
  isBase,
  isWinBase,
  isRegionBase,
  getRegionBases,
  getFlags,
  isScorched,
  isTownClaimed,
  isVictoryBase,
  isBuildSite,
  isRocket,
  getCss
}