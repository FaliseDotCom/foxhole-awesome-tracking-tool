import { get } from 'svelte/store';
import { world } from './world';
import { grid } from './grid';
import { icons } from './icons';
import { stats } from './stats';
import { warlog } from './warlog';
import { ago } from '@lib/time';

/**
 * Details of one hex for its tooltip when the map is zoomed out: its structures per team, its
 * casualties, and its latest war log entries. Read at hover time from the stores that hold them.
 */

/**
 * Latest war log entries listed per hex.
 * @type {number}
 */
const max_changes = 3;

/**
 * A number with thousands separators.
 *
 * @param {number} value Number.
 * @returns {string} "1,234".
 */
const number = value => Math.round( value ).toLocaleString( 'en' );

/**
 * Structures of a hex per team, as one line.
 *
 * @param {object[]} items Map items of the hex.
 * @returns {string} "34 structures: 20 Wardens, 10 Colonials, 4 neutral".
 */
const structuresLine = items =>
{
  const structures = items.filter( item => !icons.isResource( item.i ) ),
        count = team => structures.filter( item => item.t === team ).length,
        parts = [ [ count( 'W' ), 'Wardens' ], [ count( 'C' ), 'Colonials' ], [ count( '' ), 'neutral' ] ]
          .filter( ( [ value ] ) => value )
          .map( ( [ value, label ] ) => `${ value } ${ label }` );
  return `${ structures.length } structures${ parts.length ? `: ${ parts.join( ', ' ) }` : '' }`;
};

/**
 * Casualties of a hex as lines, from the statistics; none while there are no statistics.
 *
 * @param {string} key World data key of the hex.
 * @returns {string[]} "Casualties last hour: …" and "… last day: …".
 */
const casualtyLines = key =>
{
  const summary = get( stats ),
        hex = summary ? summary.active.find( entry => entry.key === key ) : null;
  if ( !hex ) return [];
  return [
    `Casualties last hour: ${ number( hex.hour.wardens ) } Wardens, ${ number( hex.hour.colonials ) } Colonials`,
    `Casualties last day: ${ number( hex.day.wardens ) } Wardens, ${ number( hex.day.colonials ) } Colonials`
  ];
};

/**
 * The latest war log entries of a hex as lines.
 *
 * @param {string} key World data key of the hex.
 * @returns {string[]} "Wardens took Town Base Tier 1 · 5 min ago", newest first.
 */
const changeLines = key =>
{
  const now = Date.now();
  return get( warlog.all )
    .filter( entry => entry.hex === key )
    .slice( 0, max_changes )
    .map( entry => `${ entry.teamFirst ? `${ entry.team } ` : '' }${ entry.text } · ${ ago( entry.time, now ) }` );
};

export const hexInfo = {
  /**
   * Tooltip title and lines for a hex.
   *
   * @param {string} key World data key of the hex.
   * @returns {{ title: string, lines: string[] }} Hex name, then the details.
   */
  describe( key )
  {
    const data = get( world )[ key.replace( /Hex$/, '' ) ] || get( world )[ key ] || {},
          changes = changeLines( key );
    return {
      title: grid.title( key ),
      lines: [
        structuresLine( data.d || [] ),
        ...casualtyLines( key ),
        changes.length ? 'Latest changes:' : 'No changes in the war log yet',
        ...changes
      ]
    };
  }
};
