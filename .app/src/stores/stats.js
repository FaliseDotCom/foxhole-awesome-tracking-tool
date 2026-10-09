import { writable, derived, get } from 'svelte/store';
import { config } from './config';
import { shards } from './shards';
import { grid } from './grid';
import { view } from './view';
import { perHour } from '@lib/rates';

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
 * Time spans the charts can show: what /api/stats is asked for (hours, or "war" for the whole
 * war), the button text, and the span in words. The third is the default.
 * @type {{ key: string, hours: string, title: string, label: string }[]}
 */
const spans = [
  { key: 'war', hours: 'war', title: 'War', label: 'this war' },
  { key: '7d', hours: '168', title: '7 d', label: 'the last 7 days' },
  { key: '24h', hours: '24', title: '24 h', label: 'the last 24 hours' },
  { key: '8h', hours: '8', title: '8 h', label: 'the last 8 hours' },
  { key: '4h', hours: '4', title: '4 h', label: 'the last 4 hours' }
];

/**
 * localStorage key of the chosen time span.
 * @type {string}
 */
const span_key = 'fatt-stats-span';

/**
 * Read the chosen time span.
 *
 * @returns {string} Span key, the default when none or an unknown one was saved.
 */
const readSpan = () =>
{
  try
  {
    const saved = window.localStorage.getItem( span_key );
    return spans.some( option => option.key === saved ) ? saved : spans[ 2 ].key;
  }
  catch
  {
    return spans[ 2 ].key;
  }
};

/**
 * The chosen time span of the charts.
 * @type {import('svelte/store').Writable<string>}
 */
const span = writable( typeof window === 'undefined' ? spans[ 2 ].key : readSpan() );

/**
 * The moment hovered in one of the charts, marked in all of them; 0 when none.
 * @type {import('svelte/store').Writable<number>}
 */
const hover = writable( 0 );

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
  const requested = shard,
        requested_span = get( span );
  try
  {
    const hours = spans.find( option => option.key === requested_span ).hours,
          response = await fetch( `${ config.urls.api }stats/${ requested }?hours=${ hours }` );
    // an answer for a shard or span no longer chosen is dropped
    if ( requested === shard && requested_span === get( span ) ) data.set( response.ok ? await response.json() : null );
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
 * What the Stats tab and the map shading show, worked out from the answer.
 * @type {import('svelte/store').Readable<object|null>}
 */
const summary = derived( data, $data =>
{
  if ( !$data ) return null;
  const series = $data.series || [],
        players = $data.players || [],
        viewers = $data.viewers || [],
        from = $data.from || $data.now - 86400000;

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
    // every chart spans the same time, so they line up
    from,
    to: $data.now,
    players: players.length ? players[ players.length - 1 ][ 1 ] : 0,
    playerSeries: players,
    // viewers of F.A.T.T. (open maps) over time, and now: at least this one
    viewerSeries: viewers,
    watching: Math.max( 1, $data.watching || 0 ),
    casualties: {
      wardens: perHour( series, 1, from ),
      colonials: perHour( series, 2, from )
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
  hover: { subscribe: hover.subscribe },
  span: { subscribe: span.subscribe },
  spans,

  /**
   * Show the charts over another time span, and remember it.
   *
   * @param {string} key Span key from spans.
   * @returns {void}
   */
  setSpan( key )
  {
    if ( !spans.some( option => option.key === key ) || key === get( span ) ) return;
    span.set( key );
    try
    {
      window.localStorage.setItem( span_key, key );
    }
    catch
    {
      // storage can be unavailable (private mode); the span then lasts until reload
    }
    if ( users ) load();
  },

  /**
   * Mark a moment in every chart.
   *
   * @param {number} time Moment in ms, 0 for none.
   * @returns {void}
   */
  setHover( time )
  {
    hover.set( time );
  },

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
