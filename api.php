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

  // cache buster
  $force = isset( $_GET[ 'force' ] );

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

  // get static world info
  if ( isset( $_GET[ 'maps' ] ) )
  {
    json( $api->get_map_list() );
  }

  // get static world info
  if ( isset( $_GET[ 'static' ] ) )
  {
    json( $api->get_static_world( $force ) );
  }

   // get dynamic world info
  if ( isset( $_GET[ 'dynamic' ] ) )
  {
    json( $api->get_dynamic_world( $force ) );
  }

  // get details for a certain area
  if ( isset( $_GET[ 'details' ] ) )
  {
    json( $api->get_dynamic_map( $_GET[ 'details' ], $force ) );
  }

  // clean asset files
  if ( isset( $_GET[ 'clean' ] ) )
  {
    $clean = trim( $_GET[ 'clean' ] );
    if ( 'map' == $clean || !$clean )
    {
      $api->clean_map_assets();
    }

    if ( 'icon' == $clean || !$clean )
    {
      $api->clean_icon_assets();
    }
  }