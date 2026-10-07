import { derived } from 'svelte/store';
import { world } from './world';
import { icons } from './icons';

/**
 * Structure types on the map in the current war, for the legend: one entry per name (the three
 * relic base ids share one), sorted by name. Types without an icon are left out.
 * @type {import('svelte/store').Readable<{ id: number, name: string, aliases: string }[]>}
 */
export const legend = derived( world, $world =>
{
  const types = new Map();
  Object.values( $world ).forEach( hex =>
  {
    ( hex.d || [] ).forEach( item =>
    {
      const name = icons.getName( item.i );
      if ( !name || types.has( name ) || !icons.getIcon( { i: item.i } ) ) return;
      types.set( name, { id: item.i, name, aliases: icons.getAliases( item.i ).join( ', ' ) } );
    } );
  } );
  return [ ...types.values() ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
} );
