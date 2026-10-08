import { writable, derived } from 'svelte/store';
import { config } from './config';
import { shards } from './shards';
import { world } from './world';
import { icons } from './icons';
import { grid } from './grid';
import { search } from './search';
import { ROCKET } from '@lib/rockets';

/**
 * How often the war state is refreshed, in seconds; it only changes when a war starts or ends.
 * @type {number}
 */
const refresh = 5 * 60;

/**
 * War state from the API for the selected shard, or null while unknown.
 * @type {import('svelte/store').Writable<object|null>}
 */
const state = writable( null );

/**
 * Structures counted per team next to the war bar. `armed` is a type also counted apart.
 * @type {{ key: string, title: string, types: number[], armed?: number }[]}
 */
const counted = [
  { key: 'rockets', title: 'Rocket sites', types: [ ROCKET.site, ROCKET.armed ], armed: ROCKET.armed },
  { key: 'storm', title: 'Storm cannons', types: [ 59 ] },
  { key: 'intel', title: 'Intel centres', types: [ 60 ] }
];

/**
 * Players in the game according to Steam (/api/players), or 0 while unknown.
 * @type {import('svelte/store').Writable<number>}
 */
const players = writable( 0 );

let timeout = 0,
    shard = '';

/**
 * Fetch the war state of the selected shard and schedule the next refresh.
 *
 * @returns {Promise<void>}
 */
const load = async () =>
{
  clearTimeout( timeout );
  if ( !shard ) return;

  try
  {
    const [ war_response, players_response ] = await Promise.all( [
      fetch( config.urls.api + 'war/' + shard ),
      fetch( config.urls.api + 'players' )
    ] );
    if ( war_response.ok ) state.set( await war_response.json() );
    if ( players_response.ok ) players.set( ( await players_response.json() ).count || 0 );
  }
  catch
  {
    // keep the last known state; the world store reports connection problems
  }
  timeout = setTimeout( load, refresh * 1000 );
};

shards.subscribe( s =>
{
  shard = s;
  state.set( null );
  load();
} );

/**
 * Victory towns held per team, unclaimed, and scorched, counted from the live map data.
 * Scorched victory towns count for nobody and lower the number needed to win.
 * @type {import('svelte/store').Readable<{ wardens: number, colonials: number, neutral: number, scorched: number }>}
 */
const towns = derived( world, $world =>
{
  const count = { wardens: 0, colonials: 0, neutral: 0, scorched: 0 };
  Object.values( $world ).forEach( hex =>
  {
    count.scorched += hex.s || 0;
    ( hex.d || [] ).forEach( item =>
    {
      if ( !icons.isVictoryBase( item ) || icons.isScorched( item ) ) return;
      if ( item.t === 'W' ) count.wardens++;
      if ( item.t === 'C' ) count.colonials++;
      if ( !item.t ) count.neutral++;
    } );
  } );
  return count;
} );

/**
 * Counted structures per team (W and C), from the live map data: per counted kind its number,
 * the armed ones among them, and the places, for the tooltip. Scorched ones are left out.
 * @type {import('svelte/store').Readable<Record<string, Record<string, { count: number, armed: number, places: string[] }>>>}
 */
const structures = derived( world, $world =>
{
  const result = {};
  for ( const team of [ 'W', 'C' ] )
  {
    result[ team ] = Object.fromEntries( counted.map( kind => [ kind.key, { count: 0, armed: 0, places: [] } ] ) );
  }

  Object.entries( $world ).forEach( ( [ id, hex ] ) =>
  {
    const key = grid.key( id );
    ( hex.d || [] ).forEach( item =>
    {
      if ( !result[ item.t ] || icons.isScorched( item ) ) return;
      const kind = counted.find( k => k.types.includes( item.i ) );
      if ( !kind ) return;
      const entry = result[ item.t ][ kind.key ];
      entry.count++;
      if ( item.i === kind.armed ) entry.armed++;
      if ( key ) entry.places.push( search.placeOf( key, item ) );
    } );
  } );
  return result;
} );

/**
 * Everything the war panel shows, or null until the war state is known.
 * @type {import('svelte/store').Readable<object|null>}
 */
const summary = derived( [ state, towns, structures, players ], ( [ $state, $towns, $structures, $players ] ) =>
{
  if ( !$state || !$state.warNumber ) return null;

  const start = $state.conquestStartTime || 0;
  return {
    number: $state.warNumber,
    winner: $state.winner && $state.winner !== 'NONE' ? icons.getTeam( { t: $state.winner[ 0 ] } ) : '',
    // day 1 is the first 24 hours of the war
    day: start ? Math.floor( ( Date.now() - start ) / 86400000 ) + 1 : 0,
    required: Math.max( 0, ( $state.requiredVictoryTowns || 0 ) - $towns.scorched ),
    wardens: $towns.wardens,
    colonials: $towns.colonials,
    // victory towns held by nobody, and scorched ones (which count for nobody)
    neutral: $towns.neutral,
    scorched: $towns.scorched,
    total: $towns.wardens + $towns.colonials + $towns.neutral + $towns.scorched,
    // counted structures per team, and what each counter is
    structures: $structures,
    counted,
    players: $players
  };
} );

export const war = {
  subscribe: summary.subscribe
};
