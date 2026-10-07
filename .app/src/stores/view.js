import { writable } from 'svelte/store';

/**
 * Requests to move the map, so features such as search can steer the view without reaching
 * into the panzoom component. panzoom.svelte subscribes to `request`.
 */

/**
 * How long the marker stays on a shown place, in milliseconds.
 * @type {number}
 */
const marker_time = 2500;

/**
 * Latest view request: { x, y } in map pixels plus either `box` ({ width, height } that must
 * fit on screen) or `scale`.
 * @type {import('svelte/store').Writable<object|null>}
 */
const request = writable( null );

/**
 * Point to highlight on the map ({ x, y } in map pixels), or null.
 * @type {import('svelte/store').Writable<object|null>}
 */
const marker = writable( null );

let marker_timeout = 0;

/**
 * Move the map to a place and highlight it briefly.
 *
 * @param {{ x: number, y: number, box?: { width: number, height: number }, scale?: number, marker?: boolean }} target
 *   Map point to centre, the box to fit or the scale to use, and marker: false to skip the ring.
 * @returns {void}
 */
const focus = target =>
{
  request.set( { ...target } );
  if ( target.marker === false ) return;

  clearTimeout( marker_timeout );
  marker.set( { x: target.x, y: target.y } );
  marker_timeout = setTimeout( () => marker.set( null ), marker_time );
};

export const view = {
  request: { subscribe: request.subscribe },
  marker: { subscribe: marker.subscribe },
  focus
};
