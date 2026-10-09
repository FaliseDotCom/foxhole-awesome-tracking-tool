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
   *   GET /api/analytics     where the browser sends visitor statistics: { url, site } from
   *                          the server settings (.env), or [] when tracking is off
   *   GET /api/players       players in the game (all shards, from Steam): { time, count }
   *   GET /api/health        whether the cron job runs, and War API changes found in the last
   *                          30 days (lib/watch.php), for the daily watch workflow
   *   GET /api/stats/<shard>?hours=24  casualties over time and per hex (last hour and day),
   *                          ?hours=war for the whole war, at most 300 samples per series,
   *                          when each hex last changed, players and viewers over time, and
   *                          the viewers watching now
   *   GET /api/history/<shard>?at=<ms>  the map data of every hex as it was at that moment of
   *                          the current war, like /api/data; 404 before historySince
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

  if ( $route[ 0 ] === 'health' && count( $route ) === 1 )
  {
    header( 'Cache-Control: no-store' );
    json( watch_health( $api ) );
  }

  if ( $route[ 0 ] === 'players' && count( $route ) === 1 )
  {
    json( stats_players() );
  }

  if ( $route[ 0 ] === 'analytics' && count( $route ) === 1 )
  {
    json( analytics_config() );
  }

  if ( $route[ 0 ] === 'shards' && count( $route ) === 1 )
  {
    json( $api->get_shards() );
  }

  if ( $route[ 0 ] === 'data' && count( $route ) === 2 )
  {
    // open maps ask for data every few seconds; count them as viewers (lib/viewers.php)
    viewers_seen();
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
    // where the next page of older events starts, before the major events are added below
    $next_before = count( $rows ) === $limit ? (int) end( $rows )[ 'id' ] : 0;

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
      // ?before= for the next page of older events, 0 when there are no more
      'nextBefore' => $next_before,
      // the map can be shown as it was at any moment from this time on (0: not yet)
      'historySince' => $store->getHistorySince( $shard, $war ),
      'events'     => array_map( warlog_event_json( ... ), $rows )
    ] );
  }

  if ( $route[ 0 ] === 'stats' && count( $route ) === 2 )
  {
    $shard = $route[ 1 ];
    if ( !$api->is_live_shard( $shard ) )
    {
      json( [ 'error' => 'Shard is unknown or unavailable' ], 502 );
    }
    $hours = (string) ( $_GET[ 'hours' ] ?? '24' );
    $stats = stats_summary( $shard, $hours === 'war' ? STATS_WHOLE_WAR : max( 1, (int) $hours ) );
    if ( !$stats )
    {
      json( [ 'error' => 'No statistics yet' ], 404 );
    }
    json( $stats );
  }

  if ( $route[ 0 ] === 'history' && count( $route ) === 2 )
  {
    $shard = $route[ 1 ];
    if ( !$api->is_live_shard( $shard ) )
    {
      json( [ 'error' => 'Shard is unknown or unavailable' ], 502 );
    }

    $history = warlog_history( $shard, (int) ( $_GET[ 'at' ] ?? 0 ) );
    if ( !$history )
    {
      json( [ 'error' => 'No history for that moment' ], 404 );
    }
    json( $history );
  }

  if ( $route[ 0 ] === 'war' && count( $route ) === 2 )
  {
    shard_response( $api, $route[ 1 ], fn() => $api->get_war() );
  }

  json( [ 'error' => 'Unknown API route' ], 404 );
