import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairRockets, PAIR_WINDOW, ROCKET } from '../lib/rockets.js';

// unit tests for pairing rocket launches with impacts; run with `npm run test:unit`

const minute = 60 * 1000;

/**
 * A launch entry: an armed rocket site turning back into an empty one.
 *
 * @param {string} id   Entry id.
 * @param {number} time Time in ms.
 * @returns {object} Entry.
 */
const launch = ( id, time ) => ( { id, time, kind: 'upgraded', iconFrom: ROCKET.armed, item: { i: ROCKET.site }, x: 0, y: 0, team: 'Wardens' } );

/**
 * An impact entry: a Rocket Ground Zero appearing.
 *
 * @param {string} id   Entry id.
 * @param {number} time Time in ms.
 * @returns {object} Entry.
 */
const impact = ( id, time ) => ( { id, time, kind: 'built', iconFrom: null, item: { i: ROCKET.impact }, x: 100, y: 100, team: '' } );

const ids = rockets => rockets.map( rocket => [ rocket.launch && rocket.launch.id, rocket.impact && rocket.impact.id ] );

test( 'a launch and its impact are paired', () =>
{
  assert.deepEqual( ids( pairRockets( [ launch( 'a', 0 ), impact( 'b', minute ) ] ) ), [ [ 'a', 'b' ] ] );
} );

test( 'an impact reported before its launch is still paired', () =>
{
  assert.deepEqual( ids( pairRockets( [ impact( 'b', 0 ), launch( 'a', minute ) ] ) ), [ [ 'a', 'b' ] ] );
} );

test( 'events too far apart are not paired', () =>
{
  const rockets = pairRockets( [ launch( 'a', 0 ), impact( 'b', PAIR_WINDOW + minute ) ] );
  assert.deepEqual( ids( rockets ), [ [ null, 'b' ], [ 'a', null ] ] );
} );

test( 'two rockets each get their own launch', () =>
{
  const rockets = pairRockets( [
    launch( 'a1', 0 ), impact( 'b1', 2 * minute ),
    launch( 'a2', 5 * minute ), impact( 'b2', 6 * minute )
  ] );
  assert.deepEqual( ids( rockets ), [ [ 'a2', 'b2' ], [ 'a1', 'b1' ] ] );
} );

test( 'other entries are ignored', () =>
{
  const other = { id: 'x', time: 0, kind: 'upgraded', iconFrom: 56, item: { i: 57 } };
  assert.deepEqual( pairRockets( [ other ] ), [] );
} );
