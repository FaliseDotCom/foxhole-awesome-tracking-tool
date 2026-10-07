<?php

  /**
   * API front controller. The web root .htaccess rewrites /api/<route> to this file as
   * ?route=<route>; for local development .api/router.php does the same.
   *
   * Routes:
   *   GET /api/shards        names of the shards whose War API is up
   *   GET /api/data/<shard>  compressed dynamic map data for every hex of a shard
   */

  require_once( __DIR__ . '/bootstrap.php' );

  /**
   * Send data as JSON and stop.
   * @param  array<mixed> $data   Response body.
   * @param  int          $status HTTP status code.
   * @return never
   */
  function json( array $data = [], int $status = 200 ) : never
  {
    http_response_code( $status );
    header( 'Content-Type: application/json; charset=utf-8' );
    echo json_encode( $data );
    exit;
  }

  $route = explode( '/', trim( (string) ( $_GET[ 'route' ] ?? '' ), '/' ) );
  $api = new FoxholeApi();

  if ( $route[ 0 ] === 'shards' && count( $route ) === 1 )
  {
    json( $api->get_shards() );
  }

  if ( $route[ 0 ] === 'data' && count( $route ) === 2 )
  {
    $shard = $route[ 1 ];

    // skip shards that are down rather than waiting for their requests to fail
    if ( !$api->is_live_shard( $shard ) )
    {
      json( [ 'error' => 'Shard is unknown or unavailable' ], 502 );
    }

    try
    {
      $api->set_shard( $shard );
      json( $api->async_dynamics() );
    }
    catch ( Throwable $e )
    {
      error_log( 'War API request failed: ' . $e->getMessage() );
      json( [ 'error' => 'War API unavailable for this shard' ], 502 );
    }
  }

  json( [ 'error' => 'Unknown API route' ], 404 );
