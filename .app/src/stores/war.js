import { writable, derived } from 'svelte/store';
import { config } from './config';
import { shards } from './shards';
import { world } from './world';
import { icons } from './icons';

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
    const response = await fetch( config.urls.api + 'war/' + shard );
    if ( response.ok ) state.set( await response.json() );
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
 * Everything the war panel shows, or null until the war state is known.
 * @type {import('svelte/store').Readable<object|null>}
 */
const summary = derived( [ state, towns ], ( [ $state, $towns ] ) =>
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
    total: $towns.wardens + $towns.colonials + $towns.neutral + $towns.scorched
  };
} );

export const war = {
  subscribe: summary.subscribe
};
