import { derived, writable } from 'svelte/store';
import { world } from './world';
import { icons } from './icons';
import { normalise } from './search';

/**
 * Structure types on the map in the current war, for the legend: one entry per name (the three
 * relic base ids share one), sorted by name. Types without an icon are left out.
 * @type {import('svelte/store').Readable<{ id: number, name: string, aliases: string }[]>}
 */
const types = derived( world, $world =>
{
  const found = new Map();
  Object.values( $world ).forEach( hex =>
  {
    ( hex.d || [] ).forEach( item =>
    {
      const name = icons.getName( item.i );
      if ( !name || found.has( name ) || !icons.getIcon( { i: item.i } ) ) return;
      found.set( name, { id: item.i, name, aliases: icons.getAliases( item.i ).join( ', ' ) } );
    } );
  } );
  return [ ...found.values() ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
} );

/**
 * Text typed in the legend's search field.
 * @type {import('svelte/store').Writable<string>}
 */
const query = writable( '' );

/**
 * The types that contain every word of the search, in their name or other names.
 * @type {import('svelte/store').Readable<{ id: number, name: string, aliases: string }[]>}
 */
const visible = derived( [ types, query ], ( [ $types, $query ] ) =>
{
  const words = normalise( $query ).split( ' ' ).filter( Boolean );
  return $types.filter( type =>
  {
    const text = normalise( `${ type.name } ${ type.aliases }` );
    return words.every( word => text.includes( word ) );
  } );
} );

export const legend = {
  subscribe: visible.subscribe,
  // every type on the map, before the search
  count: derived( types, $types => $types.length ),
  query: { subscribe: query.subscribe },

  /**
   * Show only the types that contain every word of a search; empty shows all.
   *
   * @param {string} value Search text.
   * @returns {void}
   */
  setQuery( value )
  {
    query.set( value );
  }
};
