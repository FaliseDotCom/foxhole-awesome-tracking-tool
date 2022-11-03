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
  62 : "Oil Field"
};

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

// get icon from ID
const getIcon = d => 
{
  const id = 'i' in d ? d.i : 0,
        team = 't' in d ? d.t : '',
        flags = getFlags( 'f' in d ? d.f : 0 );

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

    return `${ config.urls.assets }icons/${ name }.png`
  }
  else
  {
    console.warn( 'Icon missing ' + id )
  }
  return ''
}

// get name from ID
const getName = id => ( id in list ) ? list[ id ] : '';

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

export const icons = {
  list,
  getIcon,
  getName,
  isResource,
  getResource,
  isConquerable,
  isBase,
  isWinBase,
  isRegionBase,
  getRegionBases
}