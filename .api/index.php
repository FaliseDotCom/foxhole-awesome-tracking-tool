<?php

  /**
   * API front controller. The web root .htaccess rewrites /api/<route> to this file as
   * ?route=<route>; for local development .api/router.php does the same.
   *
   * Routes:
   *   GET /api/shards        names of the shards whose War API is up
   *   GET /api/data/<shard>  compressed dynamic map data for every hex of a shard: stored by the
   *                          cron job, or fetched when that is older than 30 seconds
   *   GET /api/war/<shard>   war number, start time, winner and victory towns needed
   *   GET /api/log/<shard>   war log events, newest first: ?limit=, ?since=<id>, ?before=<id>;
   *                          ?major=1 adds the major events older than the latest ones
   *   GET /api/cron          the scheduled tasks (lib/cron.php), for cron jobs that can only
   *                          request a URL; at most every 10 seconds
   *   GET /api/players       players in the game (all shards, from Steam): { time, count }
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

  /**
   * Answer a request for one shard: select it, run the callback, and send its result. A shard
   * that is down, or a War API request that fails, answers 502.
   * @param  FoxholeApi $api   API client.
   * @param  string     $shard Shard name from the URL.
   * @param  callable   $get   Returns the response data for the selected shard.
   * @return never
   */
  function shard_response( FoxholeApi $api, string $shard, callable $get ) : never
  {
    // skip shards that are down rather than waiting for their requests to fail
    if ( !$api->is_live_shard( $shard ) )
    {
      json( [ 'error' => 'Shard is unknown or unavailable' ], 502 );
    }

    try
    {
      $api->set_shard( $shard );
      json( $get() );
    }
    catch ( Throwable $e )
    {
      error_log( 'War API request failed: ' . $e->getMessage() );
      json( [ 'error' => 'War API unavailable for this shard' ], 502 );
    }
  }

  $route = explode( '/', trim( (string) ( $_GET[ 'route' ] ?? '' ), '/' ) );
  $api = new FoxholeApi();

  if ( $route[ 0 ] === 'cron' && count( $route ) === 1 )
  {
    log_line( CRON_LOG, 'url: start, PHP ' . PHP_VERSION . ' (' . PHP_SAPI . ')' );
    // every request must reach PHP, never a cached answer
    header( 'Cache-Control: no-store' );
    json( cron_run( $api, 'url' ) );
  }

  if ( $route[ 0 ] === 'players' && count( $route ) === 1 )
  {
    json( stats_players() );
  }

  if ( $route[ 0 ] === 'shards' && count( $route ) === 1 )
  {
    json( $api->get_shards() );
  }

  if ( $route[ 0 ] === 'data' && count( $route ) === 2 )
  {
    $shard = $route[ 1 ];
    shard_response( $api, $shard, function () use ( $api, $shard ) : array
    {
      // while the cron job keeps the stored map data current, visitors get that and cause no
      // War API requests; the header shows which one answered
      $data = warlog_latest( $shard );
      if ( $data )
      {
        header( 'X-Fatt-Data: stored' );
        return $data;
      }

      // the cron job stopped: fetch, record in the war log (at most every few seconds per
      // shard), and store it for the next visitors
      $data = $api->async_dynamics();
      warlog_record( $api, $shard, $data );
      warlog_save_latest( $shard, $data );
      header( 'X-Fatt-Data: live' );
      return $data;
    } );
  }

  if ( $route[ 0 ] === 'log' && count( $route ) === 2 )
  {
    $shard = $route[ 1 ];
    if ( !$api->is_live_shard( $shard ) )
    {
      json( [ 'error' => 'Shard is unknown or unavailable' ], 502 );
    }

    $store = warlog_store();
    if ( !$store )
    {
      json( [ 'error' => 'War log unavailable' ], 503 );
    }

    $status = $store->getStatus( $shard );
    if ( !$status )
    {
      json( [ 'war' => 0, 'recordedAt' => 0, 'events' => [] ] );
    }

    $since = max( 0, (int) ( $_GET[ 'since' ] ?? 0 ) );
    $before = max( 0, (int) ( $_GET[ 'before' ] ?? 0 ) );
    $limit = min( 200, max( 1, (int) ( $_GET[ 'limit' ] ?? 100 ) ) );
    $war = (int) $status[ 'war' ];
    $rows = $store->getEvents( $shard, $war, $since, $before, $limit );

    // ?major=1 on the first request also returns the major events older than the latest ones
    // (victory towns, relics, rockets), so a page opening late still sees them
    if ( !empty( $_GET[ 'major' ] ) && !$since && !$before && count( $rows ) === $limit )
    {
      $oldest = (int) end( $rows )[ 'id' ];
      $rows = array_merge( $rows, $store->getEvents( $shard, $war, 0, $oldest, 200, true ) );
    }

    json( [
      'war'        => $war,
      'recordedAt' => (int) $status[ 'recorded_at' ],
      // who recorded last (cron or request), and when the cron job last ran (0: never)
      'recordedBy' => $status[ 'recorded_by' ] ?? '',
      'cronAt'     => (int) ( $status[ 'cron_at' ] ?? 0 ),
      'events'     => array_map( warlog_event_json( ... ), $rows )
    ] );
  }

  if ( $route[ 0 ] === 'war' && count( $route ) === 2 )
  {
    shard_response( $api, $route[ 1 ], fn() => $api->get_war() );
  }

  json( [ 'error' => 'Unknown API route' ], 404 );
