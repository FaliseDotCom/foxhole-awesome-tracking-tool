import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { diffHex } from '../lib/warlog-diff.js';

// unit tests for the war log comparison; run with `npm run test:unit`. The cases are shared with
// the PHP version (.api/tests/warlog-diff-test.php), so both must give the same results.

const { cases } = JSON.parse( fs.readFileSync( new URL( './fixtures/warlog-diff.json', import.meta.url ), 'utf8' ) );

/**
 * Reduce a change to the shape the fixtures describe.
 *
 * @param {object} change Change from diffHex.
 * @returns {object} { kind, i, t, from_i, from_t }.
 */
const summarise = change => ( {
  kind: change.kind,
  i: change.item.i,
  t: change.item.t,
  from_i: change.previous ? change.previous.i : null,
  from_t: change.previous ? change.previous.t : null
} );

for ( const fixture of cases )
{
  test( fixture.name, () =>
  {
    const ignored = fixture.ignore || [];
    const changes = diffHex( fixture.previous, fixture.next, { ignore: id => ignored.includes( id ) } );
    assert.deepEqual( changes.map( summarise ), fixture.expected );
  } );
}
