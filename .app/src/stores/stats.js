import { writable, derived } from 'svelte/store';
import { config } from './config';
import { shards } from './shards';
import { grid } from './grid';
import { view } from './view';

/**
 * How often the statistics are fetched again while something uses them, in seconds; the
 * server samples every 5 minutes.
 * @type {number}
 */
const refresh = 5 * 60;

/**
 * How long a hex counts as recently changed for the map shading, in ms.
 * @type {number}
 */
const recent_window = 6 * 60 * 60 * 1000;

/**
 * Hours of history fetched for the charts.
 * @type {number}
 */
const hours = 24;

let shard = '',
    timeout = 0,
    users = 0;

/**
 * The last answer of /api/stats for the selected shard, or null while there is none.
 * Fetched only while something subscribes (the Stats tab, the map shading).
 * @type {import('svelte/store').Writable<object|null>}
 */
const data = writable( null, () =>
{
  users++;
  load();
  return () =>
  {
    users--;
    if ( !users ) clearTimeout( timeout );
  };
} );

/**
 * Fetch the statistics and schedule the next fetch.
 *
 * @returns {Promise<void>}
 */
const load = async () =>
{
  clearTimeout( timeout );
  if ( !shard ) return;
  const requested = shard;
  try
  {
    const response = await fetch( `${ config.urls.api }stats/${ requested }?hours=${ hours }` );
    if ( requested === shard ) data.set( response.ok ? await response.json() : null );
  }
  catch
  {
    // keep the last answer; try again on the next round
  }
  timeout = setTimeout( load, refresh * 1000 );
};

shards.subscribe( name =>
{
  shard = name;
  data.set( null );
  if ( users ) load();
} );

/**
 * Rates per hour between consecutive samples of a running total.
 *
 * @param {number[][]} series Samples [ time, ...values ], oldest first.
 * @param {number} index Which value of a sample.
 * @returns {number[][]} [ time, per hour ] for each sample after the first.
 */
const perHour = ( series, index ) => series.slice( 1 ).map( ( sample, i ) =>
{
  const before = series[ i ],
        hours_between = ( sample[ 0 ] - before[ 0 ] ) / 3600000;
  return [ sample[ 0 ], hours_between > 0 ? Math.max( 0, sample[ index ] - before[ index ] ) / hours_between : 0 ];
} );

/**
 * What the Stats tab and the map shading show, worked out from the answer.
 * @type {import('svelte/store').Readable<object|null>}
 */
const summary = derived( data, $data =>
{
  if ( !$data ) return null;
  const series = $data.series || [],
        players = $data.players || [];

  // the most active hexes in the last hour, by casualties of both teams
  const active = Object.entries( $data.hexes || {} )
    .map( ( [ name, hex ] ) => ( {
      name,
      key: grid.key( name ),
      title: grid.title( grid.key( name ) ) || name,
      hour: hex.hour,
      day: hex.day,
      total: hex.hour.wardens + hex.hour.colonials
    } ) )
    .filter( hex => hex.key )
    .sort( ( a, b ) => b.total - a.total || ( b.day.wardens + b.day.colonials ) - ( a.day.wardens + a.day.colonials ) );

  const latest = series.length ? series[ series.length - 1 ] : null;
  return {
    now: $data.now,
    // from when there are samples; less than an hour means the statistics are just starting
    since: series.length ? series[ 0 ][ 0 ] : 0,
    players: players.length ? players[ players.length - 1 ][ 1 ] : 0,
    playerSeries: players,
    casualties: {
      wardens: perHour( series, 1 ),
      colonials: perHour( series, 2 )
    },
    totals: latest ? { wardens: latest[ 1 ], colonials: latest[ 2 ], enlistments: latest[ 3 ] } : null,
    active,
    changed: $data.changed || {}
  };
} );

/**
 * How strongly to shade each hex (0–1) per shading setting, keyed by world data key.
 * fighting: casualties in the last hour against the busiest hex; changes: how recently the hex
 * last changed, within the last 6 hours.
 * @type {import('svelte/store').Readable<{ fighting: Record<string, number>, changes: Record<string, number> }>}
 */
const shading = derived( summary, $summary =>
{
  const result = { fighting: {}, changes: {} };
  if ( !$summary ) return result;

  const busiest = Math.max( 1, ...$summary.active.map( hex => hex.total ) );
  $summary.active.forEach( hex => result.fighting[ hex.key ] = hex.total / busiest );

  Object.entries( $summary.changed ).forEach( ( [ name, time ] ) =>
  {
    const key = grid.key( name ),
          age = $summary.now - time;
    if ( key && age < recent_window ) result.changes[ key ] = 1 - age / recent_window;
  } );
  return result;
} );

export const stats = {
  subscribe: summary.subscribe,
  shading: { subscribe: shading.subscribe },

  /**
   * Move the map to a whole hex.
   *
   * @param {string} key World data key of the hex.
   * @returns {void}
   */
  focusHex( key )
  {
    const bounds = grid.bounds( key );
    if ( !bounds ) return;
    view.focus( {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      box: { width: bounds.width, height: bounds.height },
      marker: false
    } );
  }
};
