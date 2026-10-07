<?php

/**
 * Records the war log for every live shard. Run every minute by a DirectAdmin cron job:
 *
 *   /usr/local/bin/php /home/<user>/domains/fatt.fali.se/public_html/.api/cron/record.php
 *
 * Only for the command line; .htaccess already hides the whole .api folder from the web.
 */

if ( PHP_SAPI !== 'cli' )
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
