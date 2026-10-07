<?php
  require_once( __DIR__ . '/config.php' );

  // report errors to the log only; printing them would break the JSON responses
  @ini_set( 'display_errors', 0 );
  @ini_set( 'display_startup_errors', 0 );
  error_reporting( E_ERROR );

  // log errors to a daily error log
  @ini_set( 'error_log', LOG_DIR . 'error-' . date( 'Y-m-d' ) . '.log' );

  require_once( __DIR__ . '/vendor/autoload.php' );
  require_once( __DIR__ . '/lib/cache.php' );
  require_once( __DIR__ . '/lib/api-foxhole.php' );
