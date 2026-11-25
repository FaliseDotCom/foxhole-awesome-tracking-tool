import { writable } from 'svelte/store';

/**
 * Tooltip shown next to the pointer while it is over a structure on the map:
 * { title, detail, x, y, above } with x and y in screen pixels, or null when hidden.
 * Above: shown above the pointer instead of below, for things at the bottom of the screen.
 * @type {import('svelte/store').Writable<object|null>}
 */
const store = writable( null );

export const tooltip = {
  subscribe: store.subscribe,

  /**
   * Show the tooltip at the pointer.
   *
   * @param {string} title  First line.
   * @param {string|string[]} detail Second line, or several lines.
   * @param {PointerEvent} e Event with the pointer position.
   * @param {boolean} [above] Show it above the pointer instead of below.
   * @returns {void}
   */
  show( title, detail, e, above = false )
  {
    store.set( { title, detail, x: e.clientX, y: e.clientY, above } );
  },

  /**
   * Add lines below the detail of the tooltip shown, such as information that arrived after it
   * opened. Nothing happens while it is hidden.
   *
   * @param {string[]} lines Lines to add.
   * @returns {void}
   */
  extend( lines )
  {
    store.update( tip =>
    {
      if ( !tip ) return tip;
      const detail = Array.isArray( tip.detail ) ? tip.detail : [ tip.detail ].filter( Boolean );
      return { ...tip, detail: [ ...detail, ...lines ] };
    } );
  },

  /**
   * Follow the pointer while the tooltip is shown.
   *
   * @param {PointerEvent} e Event with the pointer position.
   * @returns {void}
   */
  move( e )
  {
    store.update( tip => tip ? { ...tip, x: e.clientX, y: e.clientY } : tip );
  },

  /**
   * Hide the tooltip.
   *
   * @returns {void}
   */
  hide()
  {
    store.set( null );
  }
};
