import { writable } from 'svelte/store';

      // api urls
const api_url = 'https://fatt.fali.se/api.php',
      load_url = api_url + '?static',
      update_url = api_url + '?async',
      // time between updates in seconds
      time = 10,
      // world 'writable' store
      { subscribe, set, update } = writable( {}, () => {
        // cleanup
        return () => clearTimeout( timeout )
      } );

let timeout = 0,
    init = false

// load data once
const loadStatics = () =>
{
	// initially load static world
  fetch( load_url )
  .then( r => 
  {
    try { return r.json() }
    catch ( e ) {
      // try again in 10s on failure
      timeout = setTimeout( loadStatics, 10 * 1000 )
    }
    return null
  } )
  .then( d => {
    if ( d )
    {
      set( d )
      updateDynamics()
    }
  })
}

// updates on the dynamic world run periodically
const updateDynamics = () =>
{
  clearTimeout( timeout )
  fetch( update_url )
    .then( r => {
      try { return r.json() }
      catch ( e ) { 
        // rerun as scheduled
        timeout = setTimeout( updateDynamics, time * 1000 )
      }
      return null
  } )
  .then( d => {
    if ( d ) mergeData( d )
  })
}

// merge new data
const mergeData = ( d ) =>
{
  update( data => {
    for ( const name in data ) 
    {
      if ( name in d )
      {
        // use new data but old mapTextUItems
        data[ name ] = { 
          ...d[ name ],
          mapTextItems: data[ name ].mapTextItems
        }
      }
    }

    // return / update the modified data
    return data
  } )

  // rerun the update
  timeout = setTimeout( updateDynamics, time * 1000 )
}

// create store
const createStore = () => {
  // load once
  if ( !init )
  {
    init = true
    loadStatics()
  }
  // return the subscribe method
  return { subscribe } 
}

// only export the subscribe method
export const world = createStore()