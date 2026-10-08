import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perHour, RATE_WINDOW } from '../lib/rates.js';

// unit tests for casualties per hour from running totals; run with `npm run test:unit`

const minute = 60 * 1000;

/**
 * Samples every 5 minutes of a total that rises 300 an hour, but in uneven steps: nothing in
 * one sample, twice as much in the next, as the War API updates the hexes.
 *
 * @param {number} count Number of samples.
 * @returns {number[][]} Samples [ time, total ].
 */
const uneven = count =>
{
  const series = [];
  let total = 1000;
  for ( let i = 0; i < count; i++ )
  {
    series.push( [ i * 5 * minute, total ] );
    total += i % 2 ? 50 : 0;
  }
  return series;
};

test( 'uneven updates even out over an hour', () =>
{
  const rates = perHour( uneven( 37 ), 1, RATE_WINDOW );
  assert.ok( rates.length > 20 );
  rates.forEach( ( [ , rate ] ) => assert.ok( Math.abs( rate - 300 ) <= 50, `${ rate } is not about 300` ) );
} );

test( 'samples before the start only serve as the base', () =>
{
  const series = uneven( 37 ),
        rates = perHour( series, 1, 2 * RATE_WINDOW );
  assert.equal( rates[ 0 ][ 0 ], 2 * RATE_WINDOW );
  assert.equal( rates.length, 13 );
} );

test( 'samples further apart than an hour use the one before', () =>
{
  const rates = perHour( [ [ 0, 100 ], [ 2 * RATE_WINDOW, 300 ], [ 4 * RATE_WINDOW, 700 ] ], 1, 0 );
  assert.deepEqual( rates, [ [ 2 * RATE_WINDOW, 100 ], [ 4 * RATE_WINDOW, 200 ] ] );
} );

test( 'a total that drops counts as no casualties, not negative ones', () =>
{
  assert.deepEqual( perHour( [ [ 0, 500 ], [ RATE_WINDOW, 400 ] ], 1, 0 ), [ [ RATE_WINDOW, 0 ] ] );
} );
