<?php
  require_once( __DIR__ . '/config.php' );
  require_once( __DIR__ . '/lib/log.php' );

  // report errors to the log only; printing them would break the JSON responses
  @ini_set( 'display_errors', 0 );
  @ini_set( 'display_startup_errors', 0 );
  error_reporting( E_ERROR );

  // log errors to today's error log of the caller: the API, or the cron job (LOG_CONTEXT)
  @ini_set( 'error_log', log_path( ( defined( 'LOG_CONTEXT' ) ? LOG_CONTEXT : 'api' ) . '-error' ) );

  require_once( __DIR__ . '/vendor/autoload.php' );
  require_once( __DIR__ . '/lib/cache.php' );
  require_once( __DIR__ . '/lib/api-foxhole.php' );
  require_once( __DIR__ . '/lib/warlog.php' );
  require_once( __DIR__ . '/lib/cron.php' );
