<?php

/**
 * Runs the scheduled tasks (lib/cron.php), such as recording the war log, and reports each run in
 * .logs/<date>/cron-record.log. Run every minute by a cron job, either this script or by
 * requesting /api/cron (see the README):
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

log_line( CRON_LOG, 'cli: start, PHP ' . PHP_VERSION . ' (' . PHP_SAPI . ')' );

require_once __DIR__ . '/../bootstrap.php';

// the details are in cron-record.log; print the result for whoever runs the script by hand
echo json_encode( cron_run( new FoxholeApi(), 'cli' ), JSON_PRETTY_PRINT ) . PHP_EOL;
