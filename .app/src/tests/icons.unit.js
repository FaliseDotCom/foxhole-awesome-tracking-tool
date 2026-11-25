import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// unit tests for the icon files; run with `npm run test:unit`

/**
 * Folder with the icon styles.
 * @type {string}
 */
const icons = fileURLToPath( new URL( '../../../assets/icons/', import.meta.url ) );

/**
 * Icon styles with team and scorched versions.
 * @type {string[]}
 */
const styles = [ 'default', 'bright', 'brighter', 'superbright' ];

/**
 * Icons with team versions that are never scorched: interface pictures and old map types.
 * @type {string[]}
 */
const never_scorched = [ 'HomeBase', 'Logo', 'Manufacturing', 'Vehicle', 'Victory' ];

test( 'every structure with team icons also has a scorched icon in every style', () =>
{
  for ( const style of styles )
  {
    const files = new Set( readdirSync( icons + style ) );
    const missing = [ ...files ]
      .filter( file => file.endsWith( 'Warden.png' ) )
      .map( file => file.replace( 'Warden.png', '' ) )
      .filter( name => !never_scorched.includes( name ) && !files.has( `${ name }Scorched.png` ) );
    assert.deepEqual( missing, [], `${ style } lacks scorched icons` );
  }
} );
