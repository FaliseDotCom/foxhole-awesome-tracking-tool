import { writable, get } from 'svelte/store';

const data = {
        able   : 'https://war-service-live.foxholeservices.com/api/', 
        baker  : 'https://war-service-live-2.foxholeservices.com/api/', 
        charlie: 'https://war-service-live-3.foxholeservices.com/api/'
      },
      names = Object.keys( data ),
      store = writable( names[ 0 ] );

export const shards = {
  // subscribe to store
  subscribe: store.subscribe,
  // list all names
  list: names,
  // get URL
  url: () => data[ get( store ) ],
  // set SHARD
  set: n  => n in data ? store.set( n ) : null
}