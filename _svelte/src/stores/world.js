import { writable , get } from 'svelte/store';
import { shards } from './shards'
import { config } from './config'

      // api urls
const api_url = config.urls.api + '?data&shard=',
      // time between updates in seconds
      time = config.updates,
      // world 'writable' store, clearTimeout on last unsubscribe
      { subscribe, set } = writable( {}, () => clearTimeout( timeout ) );

let timeout = 0,
    shard = get( shards );

// updates on the dynamic world run periodically
const update = () =>
{
  clearTimeout( timeout )
  fetch( api_url + shard )
    // try to get json
    .then( r => {      
      try { return r.json() }
      catch ( e ) {}
      return null
    } )
    // update store with whatever we get from the server
    .then( set )     
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