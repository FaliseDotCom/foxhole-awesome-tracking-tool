import { get } from 'svelte/store';
import { config } from './config';
import { shards } from './shards';
import { world } from './world';
import { icons } from './icons';
import { moment } from '@lib/time';

/**
 * Since when a structure is held by its team or scorched, for its tooltip: "Taken by Colonials
 * on 17 Nov, 16:14", "Scorched on 17 Nov, 16:14". Read per hex from /api/structures when the
 * pointer reaches a structure, and kept for a minute.
 */

/**
 * How long the answer for a hex is kept, in ms.
 * @type {number}
 */
const max_age = 60 * 1000;

/**
 * Answers per shard, hex and moment: when they were asked for, and the structures.
 * @type {Map<string, { time: number, structures: Promise<object[]> }>}
 */
const cache = new Map();

/**
 * Ask the server for the structure history of a hex, or take it from the cache.
 *
 * @param {string} hex Hex name in the API.
 * @param {number} at  Moment in ms for the history view; 0 for now.
 * @returns {Promise<object[]>} Structures: { x, y, scorched, held }; none when it failed.
 */
const load = ( hex, at ) =>
{
  const shard = get( shards ),
        key = `${ shard }/${ hex }/${ at }`,
        now = Date.now();

  for ( const [ cached_key, cached ] of cache )
  {
    if ( now - cached.time > max_age ) cache.delete( cached_key );
  }
  if ( cache.has( key ) ) return cache.get( key ).structures;

  const url = `${ config.urls.api }structures/${ encodeURIComponent( shard ) }/${ encodeURIComponent( hex ) }${ at ? `?at=${ at }` : '' }`;
  const structures = fetch( url )
    .then( response => response.ok ? response.json() : {} )
    .then( data => Array.isArray( data.structures ) ? data.structures : [] )
    .catch( () => [] );
  cache.set( key, { time: now, structures } );
  return structures;
};

/**
 * Whether a structure can have a line: it is scorched or held by a team.
 *
 * @param {object} item Map item ({ i, t, f }).
 * @returns {boolean} True when it is worth asking.
 */
const hasHistory = item => !icons.isResource( item.i ) && ( Boolean( icons.isScorched( item ) ) || Boolean( item.t ) );

/**
 * The line for one structure, from its hex's history.
 *
 * @param {object}   item       Map item ({ x, y, t, f }).
 * @param {object[]} structures History of its hex.
 * @returns {string[]} One line, or none when the war log has not seen how it got its state.
 */
const sinceLines = ( item, structures ) =>
{
  const found = structures.find( structure => structure.x === item.x && structure.y === item.y );
  if ( !found ) return [];

  if ( icons.isScorched( item ) ) return found.scorched ? [ `Scorched on ${ moment( found.scorched ) }` ] : [];

  const held = found.held;
  // a team change the war log missed leaves an older owner: say nothing then
  if ( !held || held.team !== item.t ) return [];
  return [ `${ held.how === 'taken' ? 'Taken' : 'Built' } by ${ icons.getTeam( item ) } on ${ moment( held.time ) }` ];
};

export const structures = {
  /**
   * Lines for the tooltip of a structure: since when it is scorched or held by its team, at the
   * moment the map shows.
   *
   * @param {string} hex  Hex name in the API.
   * @param {object} item Map item.
   * @returns {Promise<string[]>} Lines; none when unknown.
   */
  async describe( hex, item )
  {
    if ( !hex || !hasHistory( item ) ) return [];
    const past = get( world.past );
    return sinceLines( item, await load( hex, past ? past.time : 0 ) );
  }
};
