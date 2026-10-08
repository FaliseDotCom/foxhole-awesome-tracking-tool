import { writable, get } from 'svelte/store';
import { config } from './config';

/**
 * localStorage key for the viewer's settings.
 * @type {string}
 */
const storage_key = 'fatt-settings';

/**
 * On/off settings and their defaults.
 * @type {Record<string, boolean>}
 */
const switches = {
  // alarm and impact sounds for rocket launches
  sound: true,
  // hex names written large over each hex
  names: true
};

/**
 * Settings chosen on a slider: their range, step and default.
 * @type {Record<string, { min: number, max: number, step: number, value: number }>}
 */
const ranges = {
  // icon size on the map, times the normal size
  iconScale: { min: .6, max: 1.6, step: .1, value: 1 },
  // strength of the region colours, times the normal strength
  regionStrength: { min: 0, max: 2, step: .25, value: 1 }
};

/**
 * Default settings: the first of each style, the switches, and the slider defaults.
 * @type {Record<string, string|boolean|number>}
 */
const defaults = {
  ...Object.fromEntries( Object.entries( config.styles ).map( ( [ key, styles ] ) => [ key, styles[ 0 ] ] ) ),
  ...switches,
  ...Object.fromEntries( Object.entries( ranges ).map( ( [ key, range ] ) => [ key, range.value ] ) )
};

/**
 * Whether a value is valid for a setting.
 *
 * @param {string} key   Setting name.
 * @param {*}      value Value to check.
 * @returns {boolean} True for a known style, a boolean for a switch, or a number in range.
 */
const isValid = ( key, value ) =>
{
  if ( key in switches ) return typeof value === 'boolean';
  if ( key in ranges ) return typeof value === 'number' && value >= ranges[ key ].min && value <= ranges[ key ].max;
  return key in config.styles && config.styles[ key ].includes( value );
};

/**
 * Read saved settings, keeping only valid values.
 *
 * @returns {Record<string, string|boolean|number>} Saved settings merged over the defaults.
 */
const read = () =>
{
  try
  {
    const saved = JSON.parse( window.localStorage.getItem( storage_key ) ) || {};
    const settings = { ...defaults };
    Object.keys( defaults ).forEach( key =>
    {
      if ( isValid( key, saved[ key ] ) ) settings[ key ] = saved[ key ];
    } );
    return settings;
  }
  catch
  {
    return { ...defaults };
  }
};

const store = writable( typeof window === 'undefined' ? { ...defaults } : read() );

/**
 * Change one setting and remember it.
 *
 * @param {string}                key   Setting name: a style, a switch or a slider.
 * @param {string|boolean|number} value A style from config.styles, a boolean for a switch, or a number in range.
 * @returns {void}
 */
const set = ( key, value ) =>
{
  if ( !isValid( key, value ) ) return;

  store.update( settings => ( { ...settings, [ key ]: value } ) );
  try
  {
    window.localStorage.setItem( storage_key, JSON.stringify( get( store ) ) );
  }
  catch
  {
    // storage can be unavailable (private mode); the setting still applies until reload
  }
};

export const settings = {
  subscribe: store.subscribe,
  // slider settings and their ranges, for the settings tab
  ranges,
  set
};
