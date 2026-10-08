/**
 * Smooth lines through chart points. Pure, for chart.svelte.
 *
 * The curve is monotone (Fritsch–Carlson, as d3's curveMonotoneX): between two points it never
 * rises above or dips below them, so it shows no peaks, dips or negative values the data does
 * not have.
 */

/**
 * Slope of the curve at a middle point, from the lines to its neighbours: 0 at a peak or a dip,
 * otherwise limited so the curve does not overshoot.
 *
 * @param {number[]} before Point before [ x, y ].
 * @param {number[]} point  The point [ x, y ].
 * @param {number[]} after  Point after [ x, y ].
 * @returns {number} Slope.
 */
const middleSlope = ( before, point, after ) =>
{
  const h0 = point[ 0 ] - before[ 0 ],
        h1 = after[ 0 ] - point[ 0 ],
        s0 = h0 ? ( point[ 1 ] - before[ 1 ] ) / h0 : 0,
        s1 = h1 ? ( after[ 1 ] - point[ 1 ] ) / h1 : 0;
  if ( s0 * s1 <= 0 || h0 + h1 <= 0 ) return 0;

  const p = ( s0 * h1 + s1 * h0 ) / ( h0 + h1 );
  return Math.sign( s0 ) * Math.min( Math.abs( s0 ), Math.abs( s1 ), Math.abs( p ) / 2 ) * 2;
};

/**
 * Slope of the straight line between two points, 0 when they share their x.
 *
 * @param {number[]} from First point [ x, y ].
 * @param {number[]} to   Second point [ x, y ].
 * @returns {number} Slope.
 */
const secant = ( from, to ) => to[ 0 ] - from[ 0 ] ? ( to[ 1 ] - from[ 1 ] ) / ( to[ 0 ] - from[ 0 ] ) : 0;

/**
 * An svg path through points, as a smooth monotone curve.
 *
 * @param {number[][]} points Points [ x, y ], x increasing.
 * @returns {string} Path data ("M x,y C …"), or an empty string for fewer than two points.
 */
export const monotonePath = points =>
{
  if ( points.length < 2 ) return '';

  const last = points.length - 1,
        slopes = points.map( ( point, i ) =>
        {
          if ( i === 0 ) return secant( point, points[ 1 ] );
          if ( i === last ) return secant( points[ i - 1 ], point );
          return middleSlope( points[ i - 1 ], point, points[ i + 1 ] );
        } ),
        format = value => Number( value.toFixed( 1 ) );

  let path = `M${ format( points[ 0 ][ 0 ] ) },${ format( points[ 0 ][ 1 ] ) }`;
  for ( let i = 0; i < last; i++ )
  {
    const [ x0, y0 ] = points[ i ],
          [ x1, y1 ] = points[ i + 1 ],
          third = ( x1 - x0 ) / 3;
    path += `C${ format( x0 + third ) },${ format( y0 + slopes[ i ] * third ) }`
      + ` ${ format( x1 - third ) },${ format( y1 - slopes[ i + 1 ] * third ) }`
      + ` ${ format( x1 ) },${ format( y1 ) }`;
  }
  return path;
};
