import { writable , get } from 'svelte/store';
import { shards } from './shards'
import { config } from './config'

      // api urls
const api_url = config.urls.api + '?data&shard=',
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

let timeout = 0,
    shard = get( shards );

// updates on the dynamic world run periodically
const update = () =>
{
  if ( log ) console.log( 'API update', api_url + shard )
  clearTimeout( timeout )
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
      if ( d ) set( d )      
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

// only export the subscribe method
export const world = { subscribe }