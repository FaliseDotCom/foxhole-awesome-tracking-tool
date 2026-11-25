import { writable, derived } from 'svelte/store';
import { config } from './config';

/**
 * The road network of the whole map (assets/data/roads.json, made by
 * .scripts/roads/extract-roads.py): nodes and edges in map pixels. Loaded once, the first time
 * something asks for it, since it is large and most visitors never need it.
 */

/**
 * Address of the road network.
 * @type {string}
 */
const url = `${ config.urls.data }roads.json${ config.assetsQuery }`;

/**
 * The road network, or null until it is loaded (or when loading failed).
 * @type {import('svelte/store').Writable<{ nodes: number[][], edges: object[] }|null>}
 */
const network = writable( null );

/**
 * The request for the road network, so it is made once.
 * @type {Promise<object|null>|null}
 */
let request = null;

/**
 * Load the road network, once.
 *
 * @returns {Promise<object|null>} The network, or null when it could not be loaded.
 */
const load = () =>
{
  if ( request ) return request;
  request = fetch( url )
    .then( response => response.ok ? response.json() : null )
    .then( data => data && Array.isArray( data.edges ) ? data : null )
    .catch( () => null )
    .then( data =>
    {
      network.set( data );
      // a failed request may be tried again later
      if ( !data ) request = null;
      return data;
    } );
  return request;
};

/**
 * Every road as one SVG path, for drawing the network; empty until it is loaded.
 * @type {import('svelte/store').Readable<string>}
 */
const path = derived( network, $network => $network
  ? $network.edges
    .filter( edge => Array.isArray( edge.points ) && edge.points.length > 1 )
    .map( edge => `M${ edge.points.map( point => `${ point[ 0 ] } ${ point[ 1 ] }` ).join( 'L' ) }` )
    .join( '' )
  : '' );

export const roads = {
  subscribe: network.subscribe,
  path: { subscribe: path.subscribe },
  load
};
