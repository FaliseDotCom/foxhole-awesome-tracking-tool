import { writable, get } from 'svelte/store';
import { settings } from './settings';
import { unlock, playAlarm, playImpact } from '@lib/sound';

/**
 * Dramatic effects for rocket launches and impacts: markers on the map, a flash over the
 * screen, shaking, and sound. Triggered by the war log for events that arrive while the page
 * is open, never for history loaded with the page.
 */

/**
 * How long each effect lasts, in ms.
 * @type {Record<string, number>}
 */
const durations = {
  launch: 6000,
  impact: 4000,
  rumble: 1500,
  quake: 1200,
  flash: 700
};

/**
 * Effects on the map: { id, type: launch or impact, x, y } in map pixels.
 * @type {import('svelte/store').Writable<object[]>}
 */
const markers = writable( [] );

/**
 * Screen shake: '' for none, 'rumble' (launch) or 'quake' (impact).
 * @type {import('svelte/store').Writable<string>}
 */
const shake = writable( '' );

/**
 * Whether the screen flashes white (impact).
 * @type {import('svelte/store').Writable<boolean>}
 */
const flash = writable( false );

let next_id = 1,
    shake_timer = 0,
    flash_timer = 0;

// browsers only allow sound after an interaction; unlock on the first one
if ( typeof window !== 'undefined' )
{
  for ( const type of [ 'pointerdown', 'keydown' ] )
  {
    window.addEventListener( type, unlock, { once: true, capture: true } );
  }
}

/**
 * Show a marker on the map for a while.
 *
 * @param {string} type launch or impact.
 * @param {number} x    Map x in map pixels.
 * @param {number} y    Map y in map pixels.
 * @returns {void}
 */
const addMarker = ( type, x, y ) =>
{
  const id = next_id++;
  markers.update( list => [ ...list, { id, type, x, y } ] );
  setTimeout( () => markers.update( list => list.filter( marker => marker.id !== id ) ), durations[ type ] );
};

/**
 * Shake the screen; a stronger shake replaces a weaker one.
 *
 * @param {string} kind rumble or quake.
 * @returns {void}
 */
const startShake = kind =>
{
  if ( get( shake ) === 'quake' && kind === 'rumble' ) return;
  clearTimeout( shake_timer );
  shake.set( kind );
  shake_timer = setTimeout( () => shake.set( '' ), durations[ kind ] );
};

export const effects = {
  markers: { subscribe: markers.subscribe },
  shake: { subscribe: shake.subscribe },
  flash: { subscribe: flash.subscribe },

  /**
   * A rocket was launched: flashing launch site, rumble, and the air raid siren.
   *
   * @param {{ x: number, y: number }} site Launch site in map pixels.
   * @returns {void}
   */
  launch( site )
  {
    addMarker( 'launch', site.x, site.y );
    startShake( 'rumble' );
    if ( get( settings ).sound ) playAlarm();
  },

  /**
   * A rocket hit: flash, shockwave at the impact, a strong shake, and the explosion.
   *
   * @param {{ x: number, y: number }} point Impact in map pixels.
   * @returns {void}
   */
  impact( point )
  {
    addMarker( 'impact', point.x, point.y );
    startShake( 'quake' );
    clearTimeout( flash_timer );
    flash.set( true );
    flash_timer = setTimeout( () => flash.set( false ), durations.flash );
    if ( get( settings ).sound ) playImpact();
  }
};
