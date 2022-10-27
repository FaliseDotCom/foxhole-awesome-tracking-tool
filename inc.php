<?php
  // make sure all errors are reported
  @ini_set( 'display_errors', 1 );
  @ini_set( 'display_startup_errors', 1 );
  error_reporting( E_ERROR );

  // log errors to daily error log in our logs dir
  @ini_set( 'error_log', 'logs/error-' . date( 'Y-m-d' ) . '.log');

  if ( !function_exists( 'epr' ) )
  {
    function epr()
    {
      echo '<pre>' . print_r( func_get_args(), true ) . '</pre>';
    }
  }

  require_once( 'config.php' );
  require_once( 'vendor/autoload.php' );
  require_once( 'lib/cache.php' );
  require_once( 'lib/api-foxhole.php' );

