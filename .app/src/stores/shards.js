import { writable, get } from 'svelte/store';
import { config } from './config';
import { link } from './link';

/**
 * Names of the shards that are live right now, as reported by the API.
 * @type {import('svelte/store').Writable<string[]>}
 */
const available = writable( [] );

/**
 * Whether the list of live shards has been loaded (successfully or not).
 * @type {import('svelte/store').Writable<boolean>}
 */
const loaded = writable( false );

/**
 * Selected shard name; empty until the live shards are known.
 * @type {import('svelte/store').Writable<string>}
 */
const selected = writable( '' );

/**
 * Fetch the live shards and select one: the current choice if it is live, else the shard
 * from a shared link, else the first live shard.
 *
 * @returns {Promise<void>}
 */
const load = async () =>
{
  try
  {
    const response = await fetch( config.urls.api + 'shards' );
    const names = response.ok ? await response.json() : [];
    available.set( Array.isArray( names ) ? names : [] );
  }
  catch ( error )
  {
    console.error( 'Loading shards failed', error );
    available.set( [] );
  }
  loaded.set( true );

  const names = get( available );
  if ( names.includes( get( selected ) ) ) return;

  const linked = link.initial.shard;
  selected.set( names.includes( linked ) ? linked : names[ 0 ] || '' );
};

/**
 * Select a shard, ignoring names that are not live.
 *
 * @param {string} name Shard name.
 * @returns {void}
 */
const set = name =>
{
  if ( get( available ).includes( name ) ) selected.set( name );
};

// keep the shared link in step with the selected shard
selected.subscribe( shard =>
{
  if ( shard ) link.write( { shard } );
} );

export const shards = {
  // subscribe to the selected shard name
  subscribe: selected.subscribe,
  // live shard names
  available: { subscribe: available.subscribe },
  // whether the live shard list has been loaded
  loaded: { subscribe: loaded.subscribe },
  load,
  set
};
