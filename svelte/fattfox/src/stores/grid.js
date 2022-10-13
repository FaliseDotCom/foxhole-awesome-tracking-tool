import items  from './grid_data.js';

      // item width & height
const w = 1024,
      h = 888,
      // row and column size multipliers
      c = 1.333,
      r = 2

      // rows and colums totals
let rows = 0,
    cols = 0;

// get max number of rows and columns
Object.values( items ).forEach( item => {
  cols = Math.max( item.col, cols )
  rows = Math.max( item.row, rows )
});

// entire size
const width =  parseInt( cols * w / c + w ), // 5633, //
      height = parseInt( rows * h / r + h )  // 6216 // 

  
// get coordinates of points for a certain area name
const getPoints = name =>
{
  const points = {};
  if ( name in items )
  {
    const item = items[ name ];
    if ( 'points' in item )
    {        
      for ( const point_name in item.points )
      {
        const coords = item.points[ point_name ].split( ' ' );
        if ( coords && coords.length >= 2 )
        {
          points[ point_name ] = { 
            // factor values between 0 and 1 so basically a percentage of width or height
            fx : 1 * coords[ 0 ],
            fy : 1 * coords[ 1 ],
            // pixel coordinates
            x : 1 * coords[ 0 ] * w , 
            y : 1 * coords[ 1 ] * h
          }
        }
      }
    }
  }
  return points;
};

// get polygon poins as a string for use in an SVG polygon
const getPolygons = name => 
{
  if ( name in items )
  {
    const item = items[ name ],
          points = getPoints( name );

    if ( points && 'areas' in item  )
    {      
      let areas = [];
      for ( const area_name in item.areas )
      {        
        // area contains point names referring to previously retrieved points
        const point_names = item.areas[ area_name ].split( ' ')
        let coords = '';
        point_names.forEach( point_name => 
        {       
          if ( point_name in points )
          {
            const point = points[ point_name ]
            // append to string for SVG polygon points
            coords += ` ${point.x} ${point.y}`;
          }
        });
        areas.push( coords )
      }
      return areas;
    }
  }
  return null;
}

export const grid = {
  // item names
  items: Object.keys( items ),
  // hex dimensions
  w,
  h,
  // total grid dimensions 
  width,
  height,
  // viewbox for svg
  viewbox: `0 0  ${width} ${height}`,
  // id to name
  name: name => name.replace( 'Hex', '' ),
  // id to title
  title: name => name.replace( 'Hex', '' ).split( '/(?=[A-Z])/' ).join( ' '),
  // bounds of a single grid item (hex ) as { x, y, width, height }
  bounds: name => 
  {
    if ( name in items )
    {
      const item = items[ name ]
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
  getPolygons
}