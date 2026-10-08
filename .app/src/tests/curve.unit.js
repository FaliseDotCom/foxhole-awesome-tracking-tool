import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monotonePath } from '../lib/curve.js';

// unit tests for the smooth chart lines; run with `npm run test:unit`

/**
 * The cubic segments of a path made by monotonePath.
 *
 * @param {string} path Path data.
 * @returns {number[][][]} Per segment its four points [ x, y ].
 */
const segments = path =>
{
  const numbers = path.match( /-?\d+(\.\d+)?/g ).map( Number ),
        points = [];
  for ( let i = 0; i < numbers.length; i += 2 ) points.push( [ numbers[ i ], numbers[ i + 1 ] ] );
  const result = [];
  for ( let i = 0; i + 3 < points.length; i += 3 ) result.push( points.slice( i, i + 4 ) );
  return result;
};

/**
 * A point on a cubic segment.
 *
 * @param {number[][]} segment Four points [ x, y ].
 * @param {number} t Position along the segment, 0 to 1.
 * @returns {number[]} The point [ x, y ].
 */
const at = ( segment, t ) => [ 0, 1 ].map( axis =>
  ( 1 - t ) ** 3 * segment[ 0 ][ axis ] + 3 * ( 1 - t ) ** 2 * t * segment[ 1 ][ axis ]
  + 3 * ( 1 - t ) * t ** 2 * segment[ 2 ][ axis ] + t ** 3 * segment[ 3 ][ axis ] );

test( 'fewer than two points make no path', () =>
{
  assert.equal( monotonePath( [] ), '' );
  assert.equal( monotonePath( [ [ 0, 5 ] ] ), '' );
} );

test( 'the curve goes through every point', () =>
{
  const points = [ [ 0, 60 ], [ 10, 20 ], [ 20, 40 ], [ 30, 40 ], [ 40, 5 ] ],
        parts = segments( monotonePath( points ) );
  assert.equal( parts.length, points.length - 1 );
  parts.forEach( ( part, i ) =>
  {
    assert.deepEqual( part[ 0 ], points[ i ] );
    assert.deepEqual( part[ 3 ], points[ i + 1 ] );
  } );
} );

test( 'between two points the curve stays between their values', () =>
{
  const points = [ [ 0, 70 ], [ 5, 2 ], [ 10, 68 ], [ 40, 66 ], [ 41, 0 ], [ 80, 35 ], [ 90, 35 ], [ 100, 1 ] ];
  segments( monotonePath( points ) ).forEach( part =>
  {
    const low = Math.min( part[ 0 ][ 1 ], part[ 3 ][ 1 ] ) - .1,
          high = Math.max( part[ 0 ][ 1 ], part[ 3 ][ 1 ] ) + .1;
    for ( let t = 0; t <= 1; t += .05 )
    {
      const y = at( part, t )[ 1 ];
      assert.ok( y >= low && y <= high, `${ y } outside ${ low }–${ high }` );
    }
  } );
} );

test( 'points on a straight line stay a straight line', () =>
{
  segments( monotonePath( [ [ 0, 0 ], [ 10, 10 ], [ 20, 20 ] ] ) ).forEach( part =>
    part.forEach( ( [ x, y ] ) => assert.ok( Math.abs( x - y ) < .1 ) ) );
} );
