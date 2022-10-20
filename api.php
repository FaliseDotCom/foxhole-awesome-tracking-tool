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

  // get data for specified shard
  if ( isset( $_GET[ 'data' ] ) )
  {
    json( $api->async_dynamics() );
  }

  /*
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

  // get details for a certain area
  if ( isset( $_GET[ 'updates' ] ) )
  {
    json( $api->get_dynamic_world_updates( explode(',', $_GET[ 'updates' ] ),$force ) );
  }

  // get details for a certain area
  if ( isset( $_GET[ 'update' ] ) && isset( $_GET[ 'map' ] )  )
  {
    json( $api->get_dynamic_map_updates(
      $_GET[ 'map' ],
      isset( $_GET[ 'version' ] ) ? $_GET[ 'version' ] : ''
    ) );
  }
  // async test
  if ( isset( $_GET[ 'async' ] ) )
  {
    json( $api->async_dynamics() );
  }
  */

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