<?php

/**
 * Records the war log for every live shard, and reports each run in .logs/<date>/cron-record.log.
 * Run every minute by a DirectAdmin cron job:
 *
 *   /usr/local/php84/bin/php ~/domains/fatt.fali.se/public_html/.api/cron/record.php
 *
 * Only for cron, never for web requests; .htaccess already hides the whole .api folder from the
 * web. Cron may run the CGI binary instead of the CLI one (the -q in DirectAdmin's PHP cron
 * jobs hints at that), so test for a web request rather than for PHP_SAPI === 'cli'.
 */

if ( isset( $_SERVER[ 'REQUEST_METHOD' ] ) )
{
  http_response_code( 404 );
  exit;
}

// errors of this script go to cron-error.log, not to the API's
define( 'LOG_CONTEXT', 'cron' );

// logging first: when the rest fails to load (a wrong PHP version), the log still shows the run
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/log.php';

/**
 * Report a line: to cron-record.log, and to the output for whoever runs the script by hand.
 *
 * @param  string $line Text to report.
 * @return void
 */
function cron_report( string $line ) : void
{
  log_line( LOG_CONTEXT . '-record', $line );
  echo date( 'c' ) . ' ' . $line . PHP_EOL;
}

cron_report( 'start, PHP ' . PHP_VERSION . ' (' . PHP_SAPI . ')' );

require_once __DIR__ . '/../bootstrap.php';

$api = new FoxholeApi();
$shards = $api->get_shards();
if ( !$shards )
{
  // no shard answered, or the War API is unreachable from here (a missing CA bundle shows up so)
  cron_report( 'no live shards found, nothing recorded' );
}

foreach ( $shards as $shard )
{
  try
  {
    $api->set_shard( $shard );
    $data = $api->async_dynamics();
    $events = warlog_record( $api, $shard, $data, true );
    // the hex count shows whether map data came in at all: 0 events with 0 hexes is a failed fetch
    cron_report( "{$shard}: {$events} events, " . count( $data ) . ' hexes' );
  }
  catch ( Throwable $e )
  {
    // one failing shard must not stop the others
    error_log( "War log cron failed for {$shard}: " . $e->getMessage() );
    cron_report( "{$shard}: failed, see cron-error.log" );
  }
}
