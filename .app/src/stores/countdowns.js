import { derived } from 'svelte/store';
import { world } from './world';
import { grid } from './grid';
import { ROCKET, pairCountdowns } from '@lib/rockets';

/**
 * Rocket countdowns: a Rocket Target is public on the map for about a day before the rocket is
 * fired. Each target with the armed site that will fire at it, from the map data shown, so it
 * follows the history view too. See .docs/plans/2026-10-07-rocket-arcs.md.
 */

/**
 * Items of one icon type on the map, in map pixels with their team.
 *
 * @param {object} $world Map data per hex, as the world store gives it.
 * @param {number} type   War API icon type.
 * @returns {{ x: number, y: number, team: string }[]} The items found.
 */
const itemsOfType = ( $world, type ) => Object.entries( $world ).flatMap( ( [ id, hex ] ) =>
{
  const bounds = grid.bounds( grid.key( id ) );
  if ( !bounds ) return [];
  return ( hex.d || [] )
    .filter( item => item.i === type )
    .map( item => ( { x: bounds.x + item.x * bounds.width, y: bounds.y + item.y * bounds.height, team: item.t || '' } ) );
} );

/**
 * Every Rocket Target on the map with the armed site that will fire at it, or from null when
 * that site is not on the map.
 * @type {import('svelte/store').Readable<{ from: { x: number, y: number }|null, to: { x: number, y: number, team: string } }[]>}
 */
const countdowns = derived( world, $world => pairCountdowns( itemsOfType( $world, ROCKET.armed ), itemsOfType( $world, ROCKET.target ) ) );

export const rocketCountdowns = {
  subscribe: countdowns.subscribe
};
