<?php

  /**
   * Internal api handler
   */

  require_once( 'inc.php' );

  // init classes
  $api = new FoxholeApi();

  // output json data
  function json( array $data = array() )
  {
    header( 'Content-Type: application/json; charset=utf-8' );
    echo trim( json_encode( $data, true ) );
    die;
  }

  // get a list of shards / server
  if ( isset( $_GET[ 'shards' ] ) )
  {
    json( $api->get_shards() );
  }

  // set a shars / server
  if ( isset( $_GET[ 'shard' ] ) )
  {
    $api->set_shard( $_GET[ 'shard' ] );
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