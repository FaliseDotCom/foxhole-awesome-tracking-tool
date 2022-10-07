import { writable } from 'svelte/store';

const data = {
        able   : 'https://war-service-live.foxholeservices.com/api/', 
        baker  : 'https://war-service-live-2.foxholeservices.com/api/', 
        charlie: 'https://war-service-live-3.foxholeservices.com/api/'
      },
      names = Object.keys( data ),
      { subscribe, set } = writable( names[ 0 ] );

export const shards = {
  // subscribe to store
  subscribe,
  // list all names
  list: names,
  // get URL
  url: n => n in data ? data[ n ] : '',
  // set SHARD
  set: n  => n in data ? set( n ) : null
}