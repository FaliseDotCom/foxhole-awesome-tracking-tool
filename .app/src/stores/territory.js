import { readable } from 'svelte/store';
import { grid } from './grid';
import { icons } from './icons';
import { world } from './world';
import { stats } from './stats';
import { createRegionIndex, regionKey } from '@lib/regions';

/**
 * Who holds each region of the map, and which hexes see fighting: what the region colours on
 * the map show (components/map/hex/areas.svelte), and what the route planner weighs
 * (stores/route.js).
 */

/**
 * Holder and scorched state of each region of a hex: a region takes the team of the town hall
 * or relic base in it, and is scorched when a structure in it is.
 *
 * @param {string}   hex   World data key of the hex.
 * @param {object[]} items Map items of the hex, from the world store.
 * @returns {Record<string, { team: string, scorched: boolean }>} State by region name; team is
 *   W, C or ''. Empty for a hex without region outlines.
 */
export const regionState = ( hex, items ) =>
{
  const details = grid.getDetails( hex );
  if ( !details ) return {};

  const bases = items.filter( item => item.t && icons.isRegionBase( item.i ) ),
        scorched = items.filter( icons.isScorched );

  return Object.fromEntries( Object.keys( details ).map( area =>
  {
    const base = bases.find( item => grid.areaContains( hex, area, item ) );
    return [ area, {
      team: base ? base.t : '',
      scorched: scorched.some( item => grid.areaContains( hex, area, item ) )
    } ];
  } ) );
};

/**
 * Hexes with their bounds and region outlines in world map pixels, for lib/regions.js.
 *
 * @returns {import('@lib/regions').Hex[]} Every hex of the world data.
 */
const worldHexes = () => grid.items.map( key =>
{
  const bounds = grid.bounds( key ),
        outlines = grid.getPolyArrays( key ) || {},
        areas = grid.world[ key ].areas || {};
  return {
    key,
    ...bounds,
    areas: Object.entries( areas ).map( ( [ name, area ] ) => ( {
      name,
      label: [ bounds.x + area.x * bounds.width, bounds.y + area.y * bounds.height ],
      outline: ( outlines[ name ] || [] ).map( point => [ bounds.x + point[ 0 ], bounds.y + point[ 1 ] ] )
    } ) )
  };
} );

/**
 * Index for finding the region of a map point, built on first use.
 * @type {ReturnType<typeof createRegionIndex>|null}
 */
let index = null;

/**
 * The region index of the whole map.
 *
 * @returns {ReturnType<typeof createRegionIndex>} Index with locate( x, y, hint ).
 */
const getIndex = () =>
{
  if ( !index ) index = createRegionIndex( worldHexes() );
  return index;
};

/**
 * A store that follows another but only passes a new value on when its signature changes, so
 * the map refreshes every 10 seconds do not recompute routes when nothing changed.
 *
 * @param {import('svelte/store').Readable<*>} source  Store to follow.
 * @param {function( * ): *}                     compute Value from the source's value.
 * @param {*}                                    initial Value before the first one.
 * @returns {import('svelte/store').Readable<*>} The store.
 */
const changesOf = ( source, compute, initial ) => readable( initial, set =>
{
  let signature = '';
  return source.subscribe( value =>
  {
    const next = compute( value ),
          next_signature = JSON.stringify( next instanceof Set ? [ ...next ] : next );
    if ( next_signature === signature ) return;
    signature = next_signature;
    set( next );
  } );
} );

/**
 * Holder of every region on the live map (not the moment shown in history: routes are for
 * driving now), by region key.
 * @type {import('svelte/store').Readable<Record<string, import('@lib/routing').RegionState>>}
 */
const states = changesOf( world.live, $live =>
{
  const result = {};
  for ( const [ id, data ] of Object.entries( $live ) )
  {
    const hex = grid.key( id );
    if ( !hex || !Array.isArray( data.d ) ) continue;
    for ( const [ area, state ] of Object.entries( regionState( hex, data.d ) ) )
    {
      result[ regionKey( hex, area ) ] = { hex, ...state };
    }
  }
  return result;
}, {} );

/**
 * Hexes with casualties in the last hour: the dark "fighting" hex shading.
 * @type {import('svelte/store').Readable<Set<string>>}
 */
const fighting = changesOf(
  stats.shading,
  $shading => new Set( Object.keys( $shading.fighting ).filter( key => $shading.fighting[ key ] > 0 ).sort() ),
  new Set()
);

export const territory = {
  states: { subscribe: states.subscribe },
  fighting: { subscribe: fighting.subscribe },

  /**
   * Hex and region of a map point.
   *
   * @param {number} x      Map x.
   * @param {number} y      Map y.
   * @param {string} [hint] Hex to use outside every hexagon.
   * @returns {import('@lib/regions').Place} Where the point lies.
   */
  locate: ( x, y, hint = '' ) => getIndex().locate( x, y, hint )
};
