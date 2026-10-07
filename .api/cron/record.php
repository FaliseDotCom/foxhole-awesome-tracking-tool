<?php

/**
 * Records the war log for every live shard. Run every minute by a DirectAdmin cron job:
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

require_once __DIR__ . '/../bootstrap.php';

$api = new FoxholeApi();
foreach ( $api->get_shards() as $shard )
{
  try
  {
    $api->set_shard( $shard );
    $events = warlog_record( $api, $shard, $api->async_dynamics(), true );
    echo date( 'c' ) . " {$shard}: {$events} events" . PHP_EOL;
  }
  catch ( Throwable $e )
  {
    // one failing shard must not stop the others
    error_log( "War log cron failed for {$shard}: " . $e->getMessage() );
    echo date( 'c' ) . " {$shard}: failed, see the error log" . PHP_EOL;
  }
}
