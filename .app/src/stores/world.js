import { writable, derived, get } from 'svelte/store';
import { shards } from './shards'
import { config } from './config'
import { analytics } from './analytics'

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
 * Request header with this page's viewer id, so the server can count open maps (the viewers in
 * the Stats tab, .api/lib/viewers.php).
 * @type {string}
 */
const viewer_header = 'X-Fatt-Viewer';

/**
 * Random id of this page load, sent while the page is visible. Made fresh on every load and
 * never stored, so it says nothing about who is watching.
 * @type {string}
 */
const viewer_id = Array.from( crypto.getRandomValues( new Uint8Array( 16 ) ), byte => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );

/**
 * Headers of a data request: the viewer id while the page is visible.
 *
 * @returns {Record<string, string>} Request headers.
 */
const viewerHeaders = () => typeof document !== 'undefined' && document.visibilityState === 'visible'
  ? { [ viewer_header ]: viewer_id }
  : {};

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
  fetch( api_url + shard, { headers: viewerHeaders() } )
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

/**
 * The map at a past moment while history is shown: { time, hexes } with hexes in the shape of
 * the live data, or null for the live map.
 * @type {import('svelte/store').Writable<{ time: number, hexes: object }|null>}
 */
const past = writable( null );

/**
 * What the map shows: the past moment while one is chosen, otherwise the live data. Live
 * updates keep running underneath, so going back is instant.
 * @type {import('svelte/store').Readable<object>}
 */
const shown = derived( [ { subscribe }, past ], ( [ $live, $past ] ) => $past ? $past.hexes : $live );

// when shard changes reload everything
shards.subscribe( s => {
  shard = s;
  past.set( null );
  clearTimeout( timeout );
  // drop the previous shard's data so it is not shown if the new shard fails to load
  set( {} );
  status.set( 'loading' );
  update();
});

export const world = {
  subscribe: shown.subscribe,
  // the live data even while history is shown, for comparing versions (the war log)
  live: { subscribe },
  // the past moment shown, or null
  past: { subscribe: past.subscribe },
  // state of the last request, for showing an error message
  status: { subscribe: status.subscribe },

  /**
   * Show the map as it was at a moment of the current war.
   *
   * @param {number} time Moment in ms.
   * @returns {Promise<boolean>} Whether the server had that moment.
   */
  async showAt( time )
  {
    if ( !shard ) return false;
    try
    {
      const response = await fetch( `${ config.urls.api }history/${ shard }?at=${ Math.round( time ) }` );
      if ( !response.ok ) return false;
      const history = await response.json();
      past.set( { time: history.time, hexes: augmentData( history.hexes || {} ) } );
      return true;
    }
    catch
    {
      return false;
    }
  },

  /**
   * Go back to the live map.
   *
   * @returns {void}
   */
  showLive()
  {
    if ( get( past ) ) analytics.history( 'live' );
    past.set( null );
  }
}