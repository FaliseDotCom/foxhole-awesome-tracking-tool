import { writable, derived, get } from 'svelte/store';
import { world } from './world';
import { war } from './war';
import { shards } from './shards';
import { grid } from './grid';
import { icons } from './icons';
import { search, normalise } from './search';
import { view } from './view';
import { config } from './config';
import { diffHex, teamKind } from '@lib/warlog-diff';
import { pairRockets, isLaunch, isImpact, ROCKET } from '@lib/rockets';
import { effects } from './effects';
import { analytics } from './analytics';

/**
 * War log. Normally the server records the changes and this store fetches them from
 * /api/log/<shard>. The browser also compares the map data itself (v1), and shows those entries
 * only while the server log is unavailable. See .docs/plans/2026-10-07-war-log.md.
 */

/**
 * Most entries kept per source; older ones drop off.
 * @type {number}
 */
const max_entries = 2000;

/**
 * Events fetched when the page opens.
 * @type {number}
 */
const initial_events = 100;

/**
 * The server log counts as stale when its last recording is older than this, in ms.
 * @type {number}
 */
const stale_after = 3 * 60 * 1000;

/**
 * Give up on a log request after this many ms.
 * @type {number}
 */
const request_timeout = 5000;

/**
 * localStorage key for the "Major updates only" filter.
 * @type {string}
 */
const filter_key = 'fatt-warlog-major';

/**
 * Zoom used when an entry is clicked, close enough to see the structure.
 * @type {number}
 */
const focus_scale = 1.5;

/**
 * Smallest box shown around a rocket's launch and impact, in map pixels, so a short shot does
 * not zoom in further than a single structure would.
 * @type {number}
 */
const rocket_min_box = 600;

/**
 * Structure types whose changes are always major: keep, rocket site, relic bases, and rocket
 * states. Victory towns are major through their flag. Same as MAJOR_TYPES in
 * .api/lib/warlog-recorder.php.
 * @type {number[]}
 */
const major_types = [ 27, 37, 45, 46, 47, 70, 71, 72 ];

/**
 * Kinds that read as "<team> <text>": "Wardens took …".
 * @type {string[]}
 */
const team_first_kinds = [ 'captured', 'lost', 'built', 'construction', 'completed', 'victory', 'won', 'rocket' ];

/**
 * A build site that is started again within this time, in ms, is not logged again: some sites
 * are placed and cleared over and over, every half minute. The same as REPEAT_WINDOW in
 * .api/lib/warlog-recorder.php.
 * @type {number}
 */
const repeat_window = 30 * 60 * 1000;

const server_entries = writable( [] ),
      browser_entries = writable( [] ),
      // 'loading' until the first log response, then 'server' or 'browser'
      source = writable( 'loading' ),
      // when the War API was last checked for changes, in ms: by the server's recorder, or by
      // this browser during the fallback
      checked = writable( 0 ),
      // who made the server's last recording (cron or request), and when the cron job last ran
      recorder = writable( { by: '', cronAt: 0 } ),
      unseen = writable( 0 ),
      major_only = writable( readFilter() ),
      // text typed in the war log's search field
      query = writable( '' ),
      // older server events: ?before= for the next page (0: no more), and whether one is loading
      paging = writable( { next: 0, loading: false } ),
      // the map can be shown as it was at any moment from this time on (0: not yet)
      history_since = writable( 0 );

let shard = '',
    // browser comparison: previous items and version per hex; null until the first data
    snapshot = null,
    previous_war = null,
    browser_id = 1,
    // server log: newest event id fetched, and whether a request is running
    newest_server_id = 0,
    loading = false,
    // when the fallback started; browser entries from before then are not shown
    fallback_since = 0;

/**
 * Read the "Major updates only" filter.
 *
 * @returns {boolean} Whether only major entries are shown.
 */
function readFilter()
{
  try
  {
    return typeof window !== 'undefined' && window.localStorage.getItem( filter_key ) === '1';
  }
  catch
  {
    return false;
  }
}

/**
 * Whether a change to this item is major.
 *
 * @param {object} item Map item.
 * @returns {boolean} True for victory towns, relic bases, keeps, rockets.
 */
const isMajor = item => Boolean( icons.isVictoryBase( item ) ) || major_types.includes( item.i );

/**
 * Turn a structure change into a log entry.
 *
 * @param {object} change Change from diffHex: { kind, item, previous }.
 * @param {string} hex    Hex key in the world data.
 * @param {number} time   When the War API says the hex changed, in ms.
 * @param {object} extra  Fields to set or override: id, source, major.
 * @returns {object} Log entry.
 */
const toEntry = ( change, hex, time, extra ) =>
{
  const { kind, item, previous } = change,
        bounds = grid.bounds( hex ),
        type = icons.getName( item.i );

  // the team the sentence is about: the new owner, or the one that lost or owned it
  const team = [ 'lost', 'destroyed', 'abandoned' ].includes( kind ) ? previous.t : item.t;
  const entry = { kind, item, iconFrom: previous ? previous.i : null };

  let text = '';
  let team_first = null;
  switch ( kind )
  {
    case 'upgraded':
      // rocket sites: arming and firing read better than "became"
      if ( previous.i === ROCKET.site && item.i === ROCKET.armed ) [ text, team_first ] = [ 'armed a rocket', true ];
      else if ( isLaunch( entry ) ) [ text, team_first ] = [ 'launched a rocket', true ];
      else text = `${ icons.getName( previous.i ) } became ${ type }`;
      break;
    case 'built':
      if ( isImpact( entry ) ) [ text, team_first ] = [ 'Rocket impact', false ];
      else if ( item.i === ROCKET.target ) [ text, team_first ] = [ 'Rocket target set', false ];
      else text = `built ${ type }`;
      break;
    case 'captured':
      text = previous.t ? `took ${ type } from the ${ icons.getTeam( previous ) }` : `took ${ type }`;
      break;
    case 'lost':
      text = `lost ${ type }`;
      break;
    case 'construction':
      text = `started building ${ type }`;
      break;
    case 'completed':
      text = `finished building ${ type }`;
      break;
    case 'abandoned':
      text = `${ type } build site was cleared`;
      break;
    case 'scorched':
      text = `${ type } was scorched`;
      break;
    case 'destroyed':
      text = `${ type } was destroyed`;
      break;
  }

  return {
    time,
    kind,
    major: isMajor( item ) || isMajor( previous || item ),
    team: icons.getTeam( { t: team } ),
    teamFirst: ( team_first ?? team_first_kinds.includes( kind ) ) && Boolean( team ),
    text,
    item,
    iconFrom: entry.iconFrom,
    // world data key of the hex, for the hex details when zoomed out
    hex,
    place: search.placeOf( hex, item ),
    x: bounds.x + item.x * bounds.width,
    y: bounds.y + item.y * bounds.height,
    ...extra
  };
};

/**
 * Log entry for a war-wide event (victory town totals, the war ending).
 *
 * @param {string} kind  victory or won.
 * @param {string} team  Team id: W or C.
 * @param {string} text  Text after the team name.
 * @param {number} time  Time in ms.
 * @param {object} extra Fields to set: id, source.
 * @returns {object} Log entry.
 */
const toWarEntry = ( kind, team, text, time, extra ) => ( {
  time, kind, major: true, team: icons.getTeam( { t: team } ), teamFirst: true, text, item: null, place: '', ...extra
} );

/**
 * Turn an event from /api/log into a log entry.
 *
 * @param {object} event Event from the server.
 * @returns {object|null} Log entry, or null for a hex that is not drawn.
 */
const fromEvent = event =>
{
  const extra = { id: `s${ event.id }`, source: 'server', major: event.major };

  if ( event.kind === 'victory' )
  {
    return toWarEntry( 'victory', event.team, `now hold ${ event.value } of ${ event.required } victory towns`, event.time, extra );
  }
  if ( event.kind === 'won' ) return toWarEntry( 'won', event.team, 'won the war', event.time, extra );

  const hex = grid.key( event.hex );
  if ( !hex ) return null;

  const item = { x: event.x, y: event.y, t: event.team || '', i: event.icon, f: event.flags || 0 },
        previous = event.iconFrom === null ? null : { x: event.x, y: event.y, t: event.teamFrom || '', i: event.iconFrom, f: event.flagsFrom || 0 };
  // events stored before build sites were told apart from captures say captured or lost
  const kind = previous && [ 'captured', 'lost' ].includes( event.kind ) ? teamKind( previous, item ) : event.kind;
  return toEntry( { kind, item, previous }, hex, event.time, extra );
};

/**
 * Whether an entry is not worth logging: an abandoned build site (the site simply goes away),
 * or construction that started at the same spot within repeat_window. As isNoise() in
 * .api/lib/warlog-recorder.php.
 *
 * @param {object} entry Log entry.
 * @param {object[]} entries Entries logged so far.
 * @returns {boolean} True to leave the entry out.
 */
const isNoise = ( entry, entries ) =>
{
  if ( entry.kind === 'abandoned' ) return true;
  if ( entry.kind !== 'construction' ) return false;
  return entries.some( other => other.kind === 'construction' && other.x === entry.x && other.y === entry.y
    && Math.abs( entry.time - other.time ) < repeat_window );
};

/**
 * New entries without the noise (see isNoise), keeping the first of repeated ones.
 *
 * @param {object[]} added New entries.
 * @param {object[]} existing Entries already in the list.
 * @returns {object[]} The entries worth logging.
 */
const withoutNoise = ( added, existing ) =>
{
  const kept = [];
  for ( const entry of [ ...added ].sort( ( a, b ) => a.time - b.time ) )
  {
    if ( !isNoise( entry, [ ...kept, ...existing ] ) ) kept.push( entry );
  }
  return kept;
};

/**
 * Add entries at the top of a list, newest first, and count them as unseen when that list is
 * the one being shown.
 *
 * @param {import('svelte/store').Writable<object[]>} list Server or browser entries.
 * @param {object[]} added New entries.
 * @param {boolean} shown Whether this list is currently shown.
 * @returns {void}
 */
const add = ( list, added, shown ) =>
{
  // an entry that is already there (a server repeating events) would break the keyed list
  const known = new Set( get( list ).map( entry => entry.id ) );
  const fresh = added.filter( entry => !known.has( entry.id ) );
  if ( !fresh.length ) return;
  list.update( current => [ ...fresh, ...current ]
    .sort( ( a, b ) => b.time - a.time )
    .slice( 0, max_entries ) );
  if ( shown ) unseen.update( count => count + fresh.length );
};

/**
 * Delay between a launch's effects and an impact that arrives with it, in ms: the time the arc
 * takes to draw.
 * @type {number}
 */
const flight_time = 2000;

/**
 * Sound the alarm for rocket launches and impacts among newly arrived entries.
 *
 * @param {object[]} added Entries that arrived while the page is open.
 * @returns {void}
 */
const dramatise = added =>
{
  const launches = added.filter( isLaunch ),
        impacts = added.filter( isImpact );
  launches.forEach( launch => effects.launch( launch ) );
  impacts.forEach( impact => setTimeout( () => effects.impact( impact ), launches.length ? flight_time : 0 ) );
};

/**
 * Switch between the server log and the browser's own comparison.
 *
 * @param {string} next server or browser.
 * @returns {void}
 */
const setSource = next =>
{
  const current = get( source );
  if ( current === next ) return;
  if ( next === 'browser' ) fallback_since = Date.now();
  source.set( next );
};

/**
 * Fetch log events from the server: the latest ones the first time, then the ones after the
 * newest already fetched. Decides whether the server log is healthy.
 *
 * @returns {Promise<void>}
 */
const loadServer = async () =>
{
  if ( !shard || loading ) return;
  loading = true;
  const requested_shard = shard;
  const controller = new AbortController();
  const timer = setTimeout( () => controller.abort(), request_timeout );

  try
  {
    // the first request also asks for older major events (victory towns, relics, rockets)
    const query = newest_server_id ? `since=${ newest_server_id }` : `limit=${ initial_events }&major=1`;
    const response = await fetch( `${ config.urls.api }log/${ requested_shard }?${ query }`, { signal: controller.signal } );
    if ( !response.ok ) throw new Error( `status ${ response.status }` );
    const log = await response.json();
    // the shard changed while waiting; this answer is for the old one
    if ( requested_shard !== shard ) return;

    const fresh = log.recordedAt && Date.now() - log.recordedAt < stale_after;
    if ( !fresh ) throw new Error( 'server log is not being recorded' );
    checked.set( log.recordedAt );
    recorder.set( { by: log.recordedBy || '', cronAt: log.cronAt || 0 } );
    history_since.set( log.historySince || 0 );
    // the first answer says where older events start
    if ( !newest_server_id ) paging.set( { next: log.nextBefore || 0, loading: false } );

    const events = Array.isArray( log.events ) ? log.events : [];
    // events are live (worth an alarm) only after the first answer, and not when catching up
    // after the fallback: the browser already showed those
    const live = newest_server_id > 0 && get( source ) === 'server';
    if ( events.length ) newest_server_id = Math.max( newest_server_id, ...events.map( event => event.id ) );
    // the server leaves the noise out, but not from events stored before it did
    const added = withoutNoise( events.map( fromEvent ).filter( Boolean ), get( server_entries ) );
    add( server_entries, added, get( source ) === 'server' );
    if ( live ) dramatise( added );
    setSource( 'server' );
  }
  catch
  {
    if ( requested_shard === shard ) setSource( 'browser' );
  }
  finally
  {
    clearTimeout( timer );
    loading = false;
  }
};

/**
 * Compare new world data with the browser's snapshot (the v1 log), and ask the server for news.
 *
 * @param {object} data World store value: hexes keyed without "Hex".
 * @returns {void}
 */
const onWorld = data =>
{
  const ids = Object.keys( data );
  if ( !ids.length ) return;

  const next = {};
  const added = [];
  for ( const id of ids )
  {
    const hexData = data[ id ];
    next[ id ] = { v: hexData.v, d: hexData.d || [] };

    const before = snapshot && snapshot[ id ];
    if ( !before || before.v === hexData.v ) continue;

    const hex = grid.key( id );
    if ( !hex ) continue;

    diffHex( before.d, next[ id ].d, { ignore: icons.isResource } )
      .forEach( change => added.push( toEntry( change, hex, hexData.l || Date.now(), {
        id: `b${ browser_id++ }`, source: 'browser', detected: Date.now()
      } ) ) );
  }

  snapshot = next;
  if ( get( source ) === 'browser' ) checked.set( Date.now() );
  const kept = withoutNoise( added, get( browser_entries ) );
  add( browser_entries, kept, get( source ) === 'browser' );
  if ( get( source ) === 'browser' ) dramatise( kept );
  loadServer();
};

/**
 * Log victory town totals and the end of the war, from the war store (browser source).
 *
 * @param {object|null} state War store value.
 * @returns {void}
 */
const onWar = state =>
{
  if ( !state ) return;
  const before = previous_war;
  previous_war = state;
  if ( !before || before.number !== state.number ) return;

  const added = [];
  for ( const [ key, team ] of [ [ 'wardens', 'W' ], [ 'colonials', 'C' ] ] )
  {
    if ( before[ key ] === state[ key ] ) continue;
    added.push( toWarEntry( 'victory', team, `now hold ${ state[ key ] } of ${ state.required } victory towns`, Date.now(), {
      id: `b${ browser_id++ }`, source: 'browser', detected: Date.now()
    } ) );
  }
  if ( state.winner && !before.winner )
  {
    added.push( toWarEntry( 'won', state.winner[ 0 ], 'won the war', Date.now(), {
      id: `b${ browser_id++ }`, source: 'browser', detected: Date.now()
    } ) );
  }
  add( browser_entries, added, get( source ) === 'browser' );
};

world.live.subscribe( onWorld );
war.subscribe( onWar );

// a new shard starts a new log
shards.subscribe( name =>
{
  shard = name;
  snapshot = null;
  previous_war = null;
  newest_server_id = 0;
  paging.set( { next: 0, loading: false } );
  history_since.set( 0 );
  server_entries.set( [] );
  browser_entries.set( [] );
  source.set( 'loading' );
  checked.set( 0 );
  unseen.set( 0 );
  loadServer();
} );

/**
 * One entry for a rocket whose launch and impact were both seen: "<team> fired a rocket from A
 * at B", with both points for the arc.
 *
 * @param {object} launch Launch entry.
 * @param {object} impact Impact entry.
 * @returns {object} Log entry.
 */
const toRocketEntry = ( launch, impact ) => ( {
  id: `r${ launch.id }-${ impact.id }`,
  source: impact.source,
  time: impact.time,
  kind: 'rocket',
  major: true,
  team: launch.team,
  teamFirst: Boolean( launch.team ),
  text: `fired a rocket from ${ launch.place }`,
  item: impact.item,
  place: `hit ${ impact.place }`,
  x: impact.x,
  y: impact.y,
  from: { x: launch.x, y: launch.y }
} );

/**
 * All entries in the current source: the server's, plus, while the server log is unavailable,
 * the changes this browser saw since then. Paired rocket launches and impacts are merged into
 * one rocket entry.
 * @type {import('svelte/store').Readable<object[]>}
 */
const combined = derived( [ server_entries, browser_entries, source ], ( [ $server, $browser, $source ] ) =>
{
  let list = $server;
  if ( $source === 'browser' )
  {
    list = [ ...$browser.filter( entry => entry.detected >= fallback_since ), ...$server ];
  }

  const rockets = pairRockets( list ).filter( rocket => rocket.launch && rocket.impact );
  if ( !rockets.length ) return list;

  const merged = new Set( rockets.flatMap( rocket => [ rocket.launch.id, rocket.impact.id ] ) );
  return [ ...list.filter( entry => !merged.has( entry.id ) ), ...rockets.map( r => toRocketEntry( r.launch, r.impact ) ) ]
    .sort( ( a, b ) => b.time - a.time );
} );

/**
 * Whether an entry contains every word of a search, in its team, text or place.
 *
 * @param {object} entry Log entry.
 * @param {string[]} words Normalised search words.
 * @returns {boolean} True when all words are found.
 */
const matches = ( entry, words ) =>
{
  const text = normalise( `${ entry.team || '' } ${ entry.text } ${ entry.place || '' }` );
  return words.every( word => text.includes( word ) );
};

/**
 * Entries to show, after the "Major updates only" filter and the search.
 * @type {import('svelte/store').Readable<object[]>}
 */
const visible = derived( [ combined, major_only, query ], ( [ $combined, $major_only, $query ] ) =>
{
  const words = normalise( $query ).split( ' ' ).filter( Boolean );
  return $combined.filter( entry => ( !$major_only || entry.major ) && matches( entry, words ) );
} );

/**
 * Rockets with a known launch site and impact, for drawing arcs on the map; not filtered.
 * @type {import('svelte/store').Readable<object[]>}
 */
const rockets = derived( combined, $combined => $combined.filter( entry => entry.kind === 'rocket' ) );

export const warlog = {
  subscribe: visible.subscribe,
  // every entry, before the filter and the search
  all: { subscribe: combined.subscribe },
  rockets: { subscribe: rockets.subscribe },
  unseen: { subscribe: unseen.subscribe },
  majorOnly: { subscribe: major_only.subscribe },
  query: { subscribe: query.subscribe },
  paging: { subscribe: paging.subscribe },
  historySince: { subscribe: history_since.subscribe },

  /**
   * Load the next page of older server events, for scrolling down the log as a timeline.
   *
   * @returns {Promise<void>}
   */
  async loadOlder()
  {
    const { next, loading: busy } = get( paging );
    if ( !next || busy || !shard ) return;
    paging.set( { next, loading: true } );
    const requested_shard = shard;
    try
    {
      const response = await fetch( `${ config.urls.api }log/${ requested_shard }?before=${ next }&limit=${ initial_events }` );
      if ( !response.ok ) throw new Error( `status ${ response.status }` );
      const log = await response.json();
      if ( requested_shard !== shard ) return;
      const events = Array.isArray( log.events ) ? log.events : [];
      add( server_entries, withoutNoise( events.map( fromEvent ).filter( Boolean ), get( server_entries ) ), false );
      paging.set( { next: log.nextBefore || 0, loading: false } );
    }
    catch
    {
      // try again on the next scroll
      if ( requested_shard === shard ) paging.set( { next, loading: false } );
    }
  },

  /**
   * Show the map as it was right after an entry happened, without moving it; the changed
   * structure gets a ring.
   *
   * @param {object} entry Log entry.
   * @returns {Promise<boolean>} Whether the server had that moment.
   */
  async showAt( entry )
  {
    const shown = await world.showAt( entry.time );
    if ( !shown ) return false;
    warlog.highlight( entry );
    analytics.history( 'show' );
    return shown;
  },

  /**
   * Ring the structure of an entry on the map, without moving the map (for a rocket: the
   * impact).
   *
   * @param {object} entry Log entry.
   * @returns {void}
   */
  highlight( entry )
  {
    if ( entry.item ) view.mark( { x: entry.x, y: entry.y } );
  },
  // loading, server, or browser (the fallback)
  source: { subscribe: source.subscribe },
  checked: { subscribe: checked.subscribe },
  recorder: { subscribe: recorder.subscribe },

  /**
   * Show only major entries, or all; remembered in the browser.
   *
   * @param {boolean} value Whether to show only major entries.
   * @returns {void}
   */
  setMajorOnly( value )
  {
    major_only.set( value );
    try
    {
      window.localStorage.setItem( filter_key, value ? '1' : '0' );
    }
    catch
    {
      // storage unavailable; the filter lasts until reload
    }
  },

  /**
   * Show only the entries that contain every word of a search; empty shows all.
   *
   * @param {string} value Search text.
   * @returns {void}
   */
  setQuery( value )
  {
    query.set( value );
  },

  /**
   * Mark every entry as seen (the panel is open).
   *
   * @returns {void}
   */
  markSeen()
  {
    unseen.set( 0 );
  },

  /**
   * Move the map to where an entry happened, zoomed in.
   *
   * @param {object} entry Log entry.
   * @returns {void}
   */
  focus( entry )
  {
    if ( !entry.item ) return;
    if ( !entry.from )
    {
      view.focus( { x: entry.x, y: entry.y, scale: focus_scale } );
      return;
    }

    // a rocket: fit the launch site and the impact on screen, centred between them
    view.focus( {
      x: ( entry.x + entry.from.x ) / 2,
      y: ( entry.y + entry.from.y ) / 2,
      box: {
        width: Math.max( Math.abs( entry.x - entry.from.x ), rocket_min_box ),
        height: Math.max( Math.abs( entry.y - entry.from.y ), rocket_min_box )
      },
      // the arc itself shows where it went
      marker: false
    } );
  }
};
