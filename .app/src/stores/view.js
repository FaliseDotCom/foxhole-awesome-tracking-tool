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

/**
 * Latest map control command (the on-screen buttons): { type: look|zoom|reset, … } with a
 * running id, so the same command twice still counts.
 * @type {import('svelte/store').Writable<object|null>}
 */
const command = writable( null );

let marker_timeout = 0,
    command_id = 0;

/**
 * Send a map control command to panzoom.svelte.
 *
 * @param {object} details Command type and its values.
 * @returns {void}
 */
const send = details => command.set( { ...details, id: ++command_id } );

/**
 * Highlight a place briefly with a ring, without moving the map.
 *
 * @param {{ x: number, y: number }} point Map point.
 * @returns {void}
 */
const mark = point =>
{
  clearTimeout( marker_timeout );
  marker.set( { x: point.x, y: point.y } );
  marker_timeout = setTimeout( () => marker.set( null ), marker_time );
};

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
  if ( target.marker !== false ) mark( target );
};

export const view = {
  request: { subscribe: request.subscribe },
  marker: { subscribe: marker.subscribe },
  command: { subscribe: command.subscribe },
  mark,
  focus,

  /**
   * Look further in a direction, as the arrow keys do.
   *
   * @param {number} x -1 left, 1 right, 0 neither.
   * @param {number} y -1 up, 1 down, 0 neither.
   * @returns {void}
   */
  look: ( x, y ) => send( { type: 'look', x, y } ),

  /**
   * Zoom to a scale around the screen centre.
   *
   * @param {number} scale Map scale, between the zoom store's min and max.
   * @returns {void}
   */
  zoomTo: scale => send( { type: 'zoom', scale } ),

  /**
   * Fit the whole map on screen.
   *
   * @returns {void}
   */
  reset: () => send( { type: 'reset' } )
};
