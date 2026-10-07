import { goto } from '$app/navigation';

/**
 * Shareable link in the URL hash: #<shard>/<x>/<y>/<zoom>, where x and y are the map
 * coordinates (in map pixels) at the centre of the screen. For example #able/2850/3110/0.80.
 */

/**
 * Read the state from the current URL hash.
 *
 * @returns {{ shard: string, x: number|null, y: number|null, zoom: number|null }} Linked
 *   shard and view; the view parts are null when missing or invalid.
 */
const parse = () =>
{
  const empty = { shard: '', x: null, y: null, zoom: null };
  if ( typeof window === 'undefined' ) return empty;

  const [ shard = '', ...view ] = window.location.hash.replace( /^#/, '' ).split( '/' );
  const [ x, y, zoom ] = view.map( Number );
  const valid = view.length === 3 && [ x, y, zoom ].every( Number.isFinite ) && zoom > 0;

  return valid
    ? { shard: decodeURIComponent( shard ), x, y, zoom }
    : { ...empty, shard: decodeURIComponent( shard ) };
};

/**
 * State the page was opened with; used once on start-up.
 * @type {{ shard: string, x: number|null, y: number|null, zoom: number|null }}
 */
const initial = parse();

/**
 * Current link state, kept so partial updates (only the shard, only the view) can be merged.
 * @type {{ shard: string, x: number|null, y: number|null, zoom: number|null }}
 */
let state = { ...initial };

/**
 * Update the link in the address bar without adding a history entry.
 *
 * @param {{ shard?: string, x?: number, y?: number, zoom?: number }} changes Parts to change.
 * @returns {void}
 */
const write = changes =>
{
  state = { ...state, ...changes };
  if ( !state.shard ) return;

  let hash = '#' + encodeURIComponent( state.shard );
  if ( state.zoom )
  {
    hash += `/${ Math.round( state.x ) }/${ Math.round( state.y ) }/${ state.zoom.toFixed( 2 ) }`;
  }
  if ( hash === window.location.hash ) return;

  goto( hash, { shallow: true, replace: true } ).catch( () => {} );
};

export const link = {
  initial,
  write
};
