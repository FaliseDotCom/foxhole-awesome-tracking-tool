<?php

/**
 * Runs the shared war log test cases against the PHP diff. From the repository root:
 *
 *   php .api/tests/warlog-diff-test.php
 *
 * Exits with 1 when a case fails.
 */

require_once __DIR__ . '/../lib/warlog-diff.php';

$fixtures = json_decode( (string) file_get_contents( __DIR__ . '/../../.app/src/tests/fixtures/warlog-diff.json' ), true );
$failed = 0;

foreach ( $fixtures[ 'cases' ] as $case )
{
  $changes = WarlogDiff::diff( $case[ 'previous' ], $case[ 'next' ], $case[ 'ignore' ] ?? [] );

  // reduce to the shape the fixtures describe
  $actual = array_map( fn( array $change ) : array => [
    'kind'   => $change[ 'kind' ],
    'i'      => $change[ 'item' ][ 'i' ],
    't'      => $change[ 'item' ][ 't' ],
    'from_i' => $change[ 'previous' ][ 'i' ] ?? null,
    'from_t' => $change[ 'previous' ][ 't' ] ?? null
  ], $changes );

  if ( $actual === $case[ 'expected' ] )
  {
    echo 'ok      ' . $case[ 'name' ] . PHP_EOL;
    continue;
  }

  $failed++;
  echo 'FAILED  ' . $case[ 'name' ] . PHP_EOL;
  echo '  expected ' . json_encode( $case[ 'expected' ] ) . PHP_EOL;
  echo '  actual   ' . json_encode( $actual ) . PHP_EOL;
}

echo PHP_EOL . count( $fixtures[ 'cases' ] ) . ' cases, ' . $failed . ' failed' . PHP_EOL;
exit( $failed ? 1 : 0 );
