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
  sound: true
};

/**
 * Default settings: the first style of each asset type, and the switches.
 * @type {{ icons: string, maps: string, sound: boolean }}
 */
const defaults = {
  icons: config.styles.icons[ 0 ],
  maps: config.styles.maps[ 0 ],
  ...switches
};

/**
 * Whether a value is valid for a setting.
 *
 * @param {string} key   Setting name.
 * @param {*}      value Value to check.
 * @returns {boolean} True for a known style, or a boolean for a switch.
 */
const isValid = ( key, value ) => key in switches
  ? typeof value === 'boolean'
  : key in defaults && config.styles[ key ].includes( value );

/**
 * Read saved settings, keeping only valid values.
 *
 * @returns {{ icons: string, maps: string, sound: boolean }} Saved settings merged over the defaults.
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
 * @param {string}         key   Setting name: icons, maps or sound.
 * @param {string|boolean} value A style from config.styles, or a boolean for a switch.
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
  set
};
