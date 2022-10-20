import world from './world_data.json';
import intersector from 'robust-point-in-polygon'
import { world as api } from '@stores/world'

const rebuildJSON = () =>
{
  // rebuild items for better JSON file
  const rebuildItems = () =>
  {
    const new_items = {}
    for ( const [ hex, item ] of Object.entries( world ) )
    {
      const areas = {}
      for ( const [ name, area ] of Object.entries( item.areas ) )
      {
        areas[ name ] = {
          title: name,
          x: 0,
          y: 0,
          points: area
        };
      };

      new_items[ hex ] = {
        id: 0,
        hex: hex,
        name: hex.replace( 'Hex', '' ),
        title: hex.replace( 'Hex', '' ),
        col: item.col,
        row: item.row,
        points: item.points,
        areas: areas
      }
    }
    return new_items
  }

  // only update hex data with matching name
  api.subscribe( ( d = {} ) => 
  {
    const new_items = rebuildItems();
    
    for ( const [ hex, data ] of Object.entries( d ) )
    {
      const key = hex in new_items ? hex : hex + 'Hex',
            item = new_items[ key ];

      new_items[ key ].id = data.regionId;
      new_items[ key ].labels = []

      data.mapTextItems.forEach( label => 
      {
        if ( label.mapMarkerType == 'Major' )
        {
          if ( !( label.text in item.areas ) )
          {
            new_items[ key ].areas[ label.text ] = {
              points: '',
              x: label.x,
              y: label.y
            }
          }
          else
          {
            new_items[ key ].areas[ label.text ].title = label.text;
            new_items[ key ].areas[ label.text ].x = label.x;
            new_items[ key ].areas[ label.text ].y = label.y;
          }
        }
        else
        {
          new_items[ key ].labels.push( {
            x: label.x,
            y: label.y,
            text: label.text
          })
        }
      })
    }
    // console.log( JSON.stringify( new_items ) )
    return () => {}
  })
}
      // item width & height
const w = 1024,
      h = 888,
      // row and column size multipliers
      c = 1.333,
      r = 2

      // rows and colums totals
let rows = 0,
    cols = 0;

      // cache for icons in areas
const containers = {}

// get max number of rows and columns
Object.values( world ).forEach( item => {
  cols = Math.max( item.col, cols )
  rows = Math.max( item.row, rows )
});

// entire size
const width =  parseInt( cols * w / c + w ), // 5633, //
      height = parseInt( rows * h / r + h )  // 6216 // 

// for caching
const all_points = {},
      all_coords = {},
      all_polys = {},
      all_arrays = {}

// add point, use as building tool only!
const addPoint = ( name, letter, raw ) =>
{
  const point = pointFromString( raw )
  if ( point ) 
  {
    all_points[ name ][ letter ] = point
    sortOnkeys( all_points[ name ] )
  }
  return all_points[ name ]
}

// sort object on keys
const sortOnkeys = obj => {
  Object.keys(obj)
  .sort()
  .reduce((accumulator, key) => {
    accumulator[key] = obj[key];
    return accumulator;
  }, {});
}

// build a point from a string
const pointFromString = raw =>
{
   // split coordinates string into [x,y] array
   const coords = raw.split( ' ' );
   if ( coords && coords.length >= 2 )
   {
     return { 
       // factor values between 0 and 1 so basically a percentage of width or height
       fx : 1 * coords[ 0 ],
       fy : 1 * coords[ 1 ],
       // pixel coordinates
       x : 1 * coords[ 0 ] * w, 
       y : 1 * coords[ 1 ] * h,
       // raw data string
       raw
     }
   }
   return null;
}
  
// get coordinates of points for a certain area name
const getPoints = name =>
{
  // maybe get from cache
  if ( name in all_points ) return all_points[ name ];

  // rebuild
  const points = {};
  if ( name in world )
  {
    const item = world[ name ];
    if ( 'points' in item )
    {        
      for ( const point_name in item.points )
      {
        // split coordinates string into [x,y] array
        const coords = pointFromString( item.points[ point_name ]);
        if ( coords ) points[ point_name ] = coords;
      }
    }
  }
  // sort on keys for readability
  sortOnkeys( points );
  // cache
  all_points[ name ] = points;
  return points;
};

// get both coords and polys
const getDetails = name =>
{
  const coords = getCoords( name ),
        strings = getPolyStrings( name ),
        arrays = getPolyArrays( name );
        
  if ( coords && strings && arrays )
  {
    const details = {}
    Object.keys( coords ).forEach( key =>
    {
      details[ key ] = {
        poly: strings[ key ],
        arr: arrays[ key ],
        coords: coords[ key ]
      }
    } )
    return details
  }
  return null  
}

const getCoords = name =>
{
  // maybe get from cache
  if ( name in all_coords ) return all_coords[ name ];

  if ( name in world )
  {
    const item = world[ name ],
          points = getPoints( name );

    if ( points && 'areas' in item  )
    {      
      let areas = {};
      for ( const area_name in item.areas )
      {        
        // area contains point names referring to previously retrieved points
        const point_names = item.areas[ area_name ].points.split( ' ')
        let coords = [];
        point_names.forEach( point_name => 
        {       
          if ( point_name in points )
          {
            const point = points[ point_name ]
            coords.push( {
              ...point,
              point: point_name
            } );
          }
        });
        areas[ area_name ] = coords;
      }
      all_coords[ name ] = areas;
      return areas;
    }
  }
  return null;
}

// get polygon poins as a string for use in an SVG polygon
const getPolyArrays = name => 
{
  // maybe get from cache
  if ( name in all_arrays ) return all_arrays[ name ];

  if ( name in world )
  {
    const item = world[ name ],
          coords = getCoords( name );

    if ( coords && 'areas' in item  )
    {      
      let areas = {};
      for ( const area_name in item.areas )
      {        
        const points = coords[ area_name ]
        let arr = []
        points.forEach( point => 
        {      
          arr.push( [ point.x, point.y ] )
        });
        areas[ area_name ] = arr;
      }
      all_arrays[ name ] = areas;
      return areas;
    }
  }
  return null;
}

// get polygon poins as a string for use in an SVG polygon
const getPolyStrings = name => 
{
  // maybe get from cache
  if ( name in all_polys ) return all_polys[ name ];

  if ( name in world )
  {
    const item = world[ name ],
          coords = getCoords( name );

    if ( coords && 'areas' in item  )
    {      
      let areas = {};
      for ( const area_name in item.areas )
      {        
        const points = coords[ area_name ]
        let poly = ''
        points.forEach( point => 
        {      
          // append to string for SVG polygon points
          poly += ` ${point.x} ${point.y}`;
        });
        areas[ area_name ] = poly.trim();
      }
      all_polys[ name ] = areas;
      return areas;
    }
  }
  return null;
}

// map all items to areas
const mapAreaItems = ( hex, items ) =>
{
  const details = getDetails( hex );
  if ( !details ) return;
  Object.keys( details ).forEach( key =>
  {
    items.forEach( item => areaContains( hex, key, item ) );
  } );
}

// test if an area in a hex contains an item
const areaContains = ( hex, area, item ) =>
{
  const details = getDetails( hex );

  if ( !details || !( area in details ) ) 
  {
    // console.log( 'No details for ', hex, area )
    return false;
  }

  // create a unique key for this point based on its coordinates
  const area_key = hex + '-' + area,
        item_key = item.x + '-' + item.y;

  // already cached? return the result
  if ( area_key in containers && item_key in containers[ area_key ] )
  {
    return containers[ area_key ][ item_key ]
  }

  // create structure in container if needed
  if ( !( area_key in containers ) ) containers[ area_key ] = {}

  // do a hit test
  const hit = intersector( details[ area ].arr, [ item.x * grid.w, item.y * grid.h ] ) <= 0;

  // store in cache
  containers[ area_key ][ item_key ] = hit

  // return the result
  return hit;
}

export const grid = {
  // item names
  items: Object.keys( world ),
  // hex dimensions
  w,
  h,
  // total grid dimensions 
  width,
  height,
  // viewbox for svg
  viewbox: `0 0  ${width} ${height}`,
  // id to name
  name: id => id in world ? world[ id ].name : '',
  // id to title
  title: id => id in world ? world[ id ].title : '',
  // bounds of a single grid item (hex ) as { x, y, width, height }
  bounds: id => 
  {
    if ( id in world )
    {
      const item = world[ id ]
      return { 
        x: parseInt( item.col * w / c ),
        y: parseInt( item.row * h / r ),
        width: w,
        height: h
      }
    }
    return null   
  },
  getPoints,
  getPolyStrings,
  getPolyArrays,
  getDetails,
  getCoords,
  mapAreaItems,
  areaContains,
  addPoint
}