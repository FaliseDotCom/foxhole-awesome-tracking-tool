import inside from 'robust-point-in-polygon';

/**
 * Which hex and region a point of the world map lies in. Pure, so it runs in Node tests: the
 * caller passes the hexes with their bounds and region outlines in world map pixels (built from
 * world_data.json by stores/territory.js). Used by the route planner to put every piece of
 * road in a region. See .docs/plans/2026-11-25-route-planner.md.
 */

/**
 * @typedef {Object} Area
 * @property {string} name Region name, as in world_data.json.
 * @property {number[]} label Position of the region's name, [ x, y ] in world map pixels.
 * @property {number[][]} outline Region outline, [ x, y ] points in world map pixels; empty
 *   when the hex has no outline for it.
 */

/**
 * @typedef {Object} Hex
 * @property {string} key World data key, such as "DeadLandsHex".
 * @property {number} x Left edge of the hex image in world map pixels.
 * @property {number} y Top edge of the hex image in world map pixels.
 * @property {number} width Width of the hex image in map pixels, corner to corner.
 * @property {number} height Height of the hex image in map pixels, flat side to flat side.
 * @property {Area[]} areas Regions of the hex.
 */

/**
 * @typedef {Object} Place
 * @property {string} hex World data key of the hex, '' outside every hex.
 * @property {string} area Region name, '' when the hex has no regions.
 * @property {string} key Region key, see regionKey().
 */

/**
 * Key of a region, unique on the whole map: "DeadLandsHex/The Spine".
 *
 * @param {string} hex  World data key of the hex.
 * @param {string} area Region name.
 * @returns {string} Region key.
 */
export const regionKey = ( hex, area ) => `${ hex }/${ area }`;

/**
 * Corners of the hexagon in a hex image: flat top and bottom, corners left and right.
 *
 * @param {Hex} hex Hex with its bounds.
 * @returns {number[][]} Six [ x, y ] points in world map pixels.
 */
const hexagon = hex =>
{
  const { x, y, width: w, height: h } = hex;
  return [
    [ x + w / 4, y ], [ x + w * 3 / 4, y ], [ x + w, y + h / 2 ],
    [ x + w * 3 / 4, y + h ], [ x + w / 4, y + h ], [ x, y + h / 2 ]
  ];
};

/**
 * Bounding box of a list of points.
 *
 * @param {number[][]} points [ x, y ] points.
 * @returns {{ x0: number, y0: number, x1: number, y1: number }} Box.
 */
const boxOf = points => ( {
  x0: Math.min( ...points.map( p => p[ 0 ] ) ),
  y0: Math.min( ...points.map( p => p[ 1 ] ) ),
  x1: Math.max( ...points.map( p => p[ 0 ] ) ),
  y1: Math.max( ...points.map( p => p[ 1 ] ) )
} );

/**
 * Whether a point lies in a box.
 *
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box Box.
 * @param {number} x Point x.
 * @param {number} y Point y.
 * @returns {boolean} True inside or on the edge.
 */
const inBox = ( box, x, y ) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

/**
 * Squared distance between two points.
 *
 * @param {number} x0 First x.
 * @param {number} y0 First y.
 * @param {number} x1 Second x.
 * @param {number} y1 Second y.
 * @returns {number} Squared distance.
 */
const distance2 = ( x0, y0, x1, y1 ) => ( x1 - x0 ) ** 2 + ( y1 - y0 ) ** 2;

/**
 * Index of the hexes and regions for finding the region of a point.
 *
 * @param {Hex[]} hexes Hexes with their regions, in world map pixels.
 * @returns {{ locate: function( number, number, string= ): Place, hexes: Hex[] }} The index:
 *   locate( x, y, hint ) gives the region of a point; hint is the hex to use for a point
 *   outside every hexagon (a road traced up to the very edge of the world).
 */
export const createRegionIndex = hexes =>
{
  const prepared = hexes.map( hex =>
  {
    const corners = hexagon( hex );
    return {
      hex,
      corners,
      box: boxOf( corners ),
      centre: [ hex.x + hex.width / 2, hex.y + hex.height / 2 ],
      areas: hex.areas.map( area => ( {
        ...area,
        box: area.outline.length ? boxOf( area.outline ) : null
      } ) )
    };
  } );

  const by_key = Object.fromEntries( prepared.map( entry => [ entry.hex.key, entry ] ) );

  /**
   * Hex whose hexagon holds a point; the hint, or else the nearest hex, outside every hexagon.
   *
   * @param {number} x    Point x.
   * @param {number} y    Point y.
   * @param {string} hint World data key of the hex to fall back on.
   * @returns {object|null} Prepared hex, null without hexes.
   */
  const hexAt = ( x, y, hint ) =>
  {
    const found = prepared.find( entry => inBox( entry.box, x, y ) && inside( entry.corners, [ x, y ] ) <= 0 );
    if ( found ) return found;
    if ( hint && by_key[ hint ] ) return by_key[ hint ];

    let best = null,
        nearest = Infinity;
    for ( const entry of prepared )
    {
      const d = distance2( x, y, entry.centre[ 0 ], entry.centre[ 1 ] );
      if ( d < nearest )
      {
        nearest = d;
        best = entry;
      }
    }
    return best;
  };

  /**
   * Region of a hex that holds a point: the outline it lies in, or else the region whose name
   * is nearest (outlines are partly approximate and do not always cover the whole hex).
   *
   * @param {object} entry Prepared hex.
   * @param {number} x     Point x.
   * @param {number} y     Point y.
   * @returns {string} Region name, '' for a hex without regions.
   */
  const areaAt = ( entry, x, y ) =>
  {
    const found = entry.areas.find( area => area.box && inBox( area.box, x, y ) && inside( area.outline, [ x, y ] ) <= 0 );
    if ( found ) return found.name;

    let best = '',
        nearest = Infinity;
    for ( const area of entry.areas )
    {
      const d = distance2( x, y, area.label[ 0 ], area.label[ 1 ] );
      if ( d < nearest )
      {
        nearest = d;
        best = area.name;
      }
    }
    return best;
  };

  return {
    hexes,

    /**
     * Hex and region of a point.
     *
     * @param {number} x      Point x in world map pixels.
     * @param {number} y      Point y in world map pixels.
     * @param {string} [hint] Hex to use outside every hexagon ('').
     * @returns {Place} Where the point lies; empty strings without hexes.
     */
    locate( x, y, hint = '' )
    {
      const entry = hexAt( x, y, hint );
      if ( !entry ) return { hex: '', area: '', key: '' };
      const area = areaAt( entry, x, y );
      return { hex: entry.hex.key, area, key: regionKey( entry.hex.key, area ) };
    }
  };
};
