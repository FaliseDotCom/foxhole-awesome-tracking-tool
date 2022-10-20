import { writable , get } from 'svelte/store';
import { shards } from './shards'
import { config } from './config'

      // api urls
const api_url = config.urls.api + '?data&shard=',
      // time between updates in seconds
      time = config.updates,
      // world 'writable' store, clearTimeout on last unsubscribe
      { subscribe, set } = writable( {}, () => clearTimeout( timeout ) ),
      // should we log?
      log = config.log.api;

let timeout = 0,
    shard = get( shards );

// updates on the dynamic world run periodically
const update = () =>
{
  if ( log ) console.log( 'API update' )
  clearTimeout( timeout )
  fetch( api_url + shard )
    // try to get json
    .then( r => {      
      if ( log ) console.log( 'API result', r );
      try { return r.json() }
      catch ( e ) { if ( log ) console.log( 'API error', e ) }
      return null;
    } )
    // update store with whatever we get from the server
    .then( d =>  {
      if ( log ) console.log( 'JSON result', d );
      set( d )      
    } )
    // rerun the update no matter what)
    .finally( () => timeout = setTimeout( update, time * 1000 ) )
}

// when shard changes reload everything
shards.subscribe( s => {
  shard = s;
  clearTimeout( timeout );
  update();
});

// run update asap
update();

// only export the subscribe method
export const world = { subscribe }