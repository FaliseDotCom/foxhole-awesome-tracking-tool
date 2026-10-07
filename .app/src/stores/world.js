import { writable , get } from 'svelte/store';
import { shards } from './shards'
import { config } from './config'

      // api urls
const api_url = config.urls.api + 'data/',
      // time between updates in seconds
      time = config.updates,
      // world 'writable' store, clearTimeout on last unsubscribe
      { subscribe, set } = writable( {}, () => {
        // start updates on first unsubscription
        update();
        // cleanup on unsubscribe
        return () => clearTimeout( timeout ) 
      } ),
      // should we log?
      log = config.log.api;

/**
 * State of the last data request: loading (none finished yet), ok, or error.
 * @type {import('svelte/store').Writable<string>}
 */
const status = writable( 'loading' );

let timeout = 0,
    shard = get( shards );

// updates on the dynamic world run periodically
const update = () =>
{
  clearTimeout( timeout )
  // wait until a live shard is known; selecting one triggers the next update
  if ( !shard ) return;
  if ( log ) console.log( 'API update', api_url + shard )
  fetch( api_url + shard )
    // get response text
    .then( r => {      
      if ( log ) console.log( 'API result', r.status );
      return  r.ok && r.status === 200 ? r.text() : null;
    } )
    // see if response text is json
    .then( t => {
      if ( t )
      {
        try
        {
          // try to manually convert it to JSON since using fetch's .json crashes the app even in a try / catch
          if ( log ) console.debug( 'API content', t )
          return JSON.parse( t )
        }
        catch( e )
        {
          if ( log ) console.warn( 'API content error', e )
        }
      }
      return null
    })
    // update store with whatever we get from the server
    .then( d =>  {
      if ( d ) set( augmentData( d ) )
      status.set( d ? 'ok' : 'error' )
    } )
    // network errors: keep the last data, report it, and try again on the next round
    .catch( e => {
      if ( log ) console.warn( 'API request failed', e )
      status.set( 'error' )
    } )
    // rerun the update no matter what)
    .finally( () => timeout = setTimeout( update, time * 1000 ) )
}

// do stuff with data
const augmentData = d =>
{
  Object.values( d ).forEach( data =>
  {
    if ( 'd' in data )
    {
      // add keys
      data.d.forEach( item => {
        item.key = `${item.x}-${item.y}-${item.i}`
      })
    }
  } );
  return d;
}

// when shard changes reload everything
shards.subscribe( s => {
  shard = s;
  clearTimeout( timeout );
  // drop the previous shard's data so it is not shown if the new shard fails to load
  set( {} );
  status.set( 'loading' );
  update();
});

export const world = {
  subscribe,
  // state of the last request, for showing an error message
  status: { subscribe: status.subscribe }
}