import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewerIds, VIEWER_ID_LIFETIME } from '../lib/viewer-id.js';

// unit tests for the viewer id open maps send; run with `npm run test:unit`

/**
 * A localStorage stand-in, shared by the "tabs" of one browser.
 *
 * @returns {{ getItem: Function, setItem: Function }} Storage.
 */
const browserStorage = () =>
{
  const items = new Map();
  return {
    getItem: key => items.has( key ) ? items.get( key ) : null,
    setItem: ( key, value ) => items.set( key, String( value ) )
  };
};

/**
 * Storage that is blocked, as in some private modes.
 * @type {() => never}
 */
const blocked = () =>
{
  throw new Error( 'SecurityError' );
};

test( 'an id is 32 hex characters, as the server accepts', () =>
{
  assert.match( viewerIds( browserStorage )( 0 ), /^[0-9a-f]{32}$/ );
} );

test( 'a reload keeps the id: the new page finds it in storage', () =>
{
  const storage = browserStorage(),
        id = viewerIds( () => storage )( 1000 ),
        reloaded = viewerIds( () => storage );
  assert.equal( reloaded( 3000 ), id );
} );

test( 'two tabs of one browser share the id; another browser has its own', () =>
{
  const storage = browserStorage(),
        first = viewerIds( () => storage ),
        second = viewerIds( () => storage ),
        other = browserStorage();
  const id = first( 1000 );
  assert.equal( second( 2000 ), id );
  assert.equal( first( 12000 ), id );
  assert.notEqual( viewerIds( () => other )( 2000 ), id );
} );

test( 'an id in use is kept for as long as it is used', () =>
{
  const storage = browserStorage(),
        ids = viewerIds( () => storage ),
        id = ids( 0 );
  for ( let time = 10000; time < 3 * VIEWER_ID_LIFETIME; time += 10000 )
  {
    assert.equal( ids( time ), id );
  }
} );

test( 'an id unused for as long as the server counts a viewer is renewed', () =>
{
  const storage = browserStorage(),
        id = viewerIds( () => storage )( 0 );
  assert.equal( viewerIds( () => storage )( VIEWER_ID_LIFETIME - 1 ), id );
  assert.notEqual( viewerIds( () => storage )( 2 * VIEWER_ID_LIFETIME ), id );
} );

test( 'a damaged stored value is replaced', () =>
{
  const storage = browserStorage();
  storage.setItem( 'fatt-viewer', '{ not json' );
  const id = viewerIds( () => storage )( 0 );
  assert.match( id, /^[0-9a-f]{32}$/ );
  assert.equal( JSON.parse( storage.getItem( 'fatt-viewer' ) ).id, id );
} );

test( 'without storage the id lasts for the page', () =>
{
  const ids = viewerIds( blocked ),
        id = ids( 0 );
  assert.equal( ids( 10000 ), id );
  assert.notEqual( viewerIds( blocked )( 10000 ), id );
} );
