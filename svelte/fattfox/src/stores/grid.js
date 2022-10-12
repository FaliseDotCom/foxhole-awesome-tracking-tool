// import { readable } from 'svelte/store';

      // raw data
const items = { 
        "NevishLineHex": [0, 3], 
        "OarbreakerHex": [0, 5], 
        "FishermansRowHex": [0, 7], 
        "OriginHex": [0, 9], 
        "CallumsCapeHex": [1, 2], 
        "StonecradleHex": [1, 4], 
        "FarranacCoastHex": [1, 6], 
        "WestgateHex": [1, 8], 
        "AshFieldsHex": [1, 10], 
        "SpeakingWoodsHex": [2, 1], 
        "MooringCountyHex": [2, 3], 
        "LinnMercyHex": [2, 5], 
        "LochMorHex": [2, 7], 
        "HeartlandsHex": [2, 9], 
        "RedRiverHex": [2, 11], 
        "BasinSionnachHex": [3, 0], 
        "ReachingTrailHex": [3, 2], 
        "CallahansPassageHex": [3, 4], 
        "DeadLandsHex": [3, 6,
        {
          "The Spine": "0 0 0.08 0.345 0.29 0.40 0.364 0.362 0.411 0",
          "Iron's End": "0.411 0 0.364 0.362 0.464 0.392 0.62 0.31",
          "Callahan's Gate": "0.411 0 0.62 0.31 0.666 0.328 0.875 0.177 1 0"
        }], 
        "UmbralWildwoodHex": [3, 8], 
        "GreatMarchHex": [3, 10], 
        "KalokaiHex": [3, 12], 
        "HowlCountyHex": [4, 1], 
        "ViperPitHex": [4, 3], 
        "MarbanHollow": [4, 5], // no HEX!
        "DrownedValeHex": [4, 7], 
        "ShackledChasmHex": [4, 9], 
        "AcrithiaHex": [4, 11], 
        "ClansheadValleyHex": [5, 2], 
        "WeatheredExpanseHex": [5, 4], 
        "EndlessShoreHex": [5, 6], 
        "AllodsBightHex": [5, 8], 
        "TerminusHex": [5, 10], 
        "MorgensCrossingHex": [6, 3], 
        "GodcroftsHex": [6, 5], 
        "TempestIslandHex": [6, 7], 
        "TheFingersHex": [6, 9] 
      },
      // item width & height
      w = 1024,
      h = 888,
      // row and column size multipliers
      c = 1.333,
      r = 2
      
  let rows = 0,
      cols = 0;

 // get max number of rows and columns
 Object.values( items ).forEach( item => {
  cols = Math.max( item[ 0 ], cols )
  rows = Math.max( item[ 1 ], rows )
 });

 // entire size
 const width =  parseInt( cols * w / c + w ), // 5633, //
       height = parseInt( rows * h / r + h )  // 6216 // 

export const grid = {
  // item names
  items: Object.keys( items ),
  // total grid width 
  width,
  // total grid height
  height,
  // viewbox for svg
  viewbox: `0 0  ${width} ${height}`,
  // id to name
  name: n => n.replace( 'Hex', '' ),
  // id to title
  title: n => n.replace( 'Hex', '' ).split( '/(?=[A-Z])/' ).join( ' '),
  // bounds of a single grid item (hex ) as { x, y, width, height }
  bounds: n => 
  {
    if ( n in items )
    {
      const i = items[ n ]
      return { 
        x: parseInt( i[ 0 ] * w / c ),
        y: parseInt( i[ 1 ] * h / r ),
        width: w,
        height: h
      }
    }
    return null   
  },
  areas: n => 
  {
    if ( n in items && items[ n ].length > 2 )
    {
      const data = Object.values( items[ n ][ 2 ] );
      let areas = [];
      data.forEach( d => {
        const pairs = d.replace( '  ', ' ' ).split( ' ' );
        let coords = '';
        for( var i=0; i<pairs.length; i+=2 )
        {
          const x = parseInt( pairs[ i ]  * w ),
                y = parseInt( pairs[ i + 1 ] * h );
          coords += ` ${x} ${y}`;
        }
        areas.push( coords )
      })
      return areas;
    }
    return null;
  }
}