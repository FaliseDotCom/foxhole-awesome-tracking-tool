import { writable, get } from 'svelte/store';
import { config } from './config';

/**
 * Names of the shards that are live right now, as reported by the API.
 * @type {import('svelte/store').Writable<string[]>}
 */
const available = writable( [] );

/**
 * Selected shard name; empty until the live shards are known.
 * @type {import('svelte/store').Writable<string>}
 */
const selected = writable( '' );

/**
 * Fetch the live shards and select the first one if the current choice is not live.
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

  const names = get( available );
  if ( !names.includes( get( selected ) ) )
  {
    selected.set( names.length ? names[ 0 ] : '' );
  }
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

export const shards = {
  // subscribe to the selected shard name
  subscribe: selected.subscribe,
  // live shard names
  available: { subscribe: available.subscribe },
  load,
  set
};
