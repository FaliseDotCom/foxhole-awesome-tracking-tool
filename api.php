<?php

  /**
   * Internal api handler
   */

  // make sure all errors are reported
  @ini_set( 'display_errors', 1 );
  @ini_set( 'display_startup_errors', 1 );
  error_reporting( E_ALL );

  // log errors to daily error log in our logs dir
  @ini_set( 'error_log', 'logs/error-' . date( 'Y-m-d' ) . '.log');

  require_once( 'config.php' );
  require_once( 'vendor/autoload.php' );
  require_once( 'lib/cache.php' );
  require_once( 'lib/api-foxhole.php' );

  /**
   * Debug output to screen
   * @return [type] [description]
   */
  if ( !function_exists( 'epr' ) )
  {
    function epr()
    {
      echo '<pre>' . print_r( func_get_args(), true ) . '</pre>';
    }
  }
  // init classes
  $api = new FoxholeApi();

  // output json data
  function json( array $data = array() )
  {
    header( 'Content-Type: application/json; charset=utf-8' );
    echo trim( json_encode( $data, true ) );
    die;
  }

  // get a list of the entire map data
  if ( isset( $_GET[ 'map' ] ) )
  {
    json( $api->get_map() );
  }

  // get details for a certain area
  if ( isset( $_GET[ 'details' ] ) )
  {
    json( $api->get_dynamic_map( $_GET[ 'details' ] ) );
  }

  // clear map asset file names
  if ( isset( $_GET[ 'clear_map_files' ] ) )
  {
    $api->clear_map_files();
  }