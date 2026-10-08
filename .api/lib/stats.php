<?php

use GuzzleHttp\Client;

/**
 * Statistics over time, recorded by cron tasks (see cron.php): the war report of every hex
 * (enlistments and casualties) and the number of players in the game. Stored next to the war
 * log in its database.
 */

/**
 * Samples closer together than this are skipped, in seconds; the cron job runs every 15.
 * @var int
 */
const STATS_INTERVAL = 5 * 60;

/**
 * Hours of statistics that stand for the whole current war in /api/stats (?hours=war).
 * @var int
 */
const STATS_WHOLE_WAR = 0;

/**
 * Most samples per series in /api/stats; longer spans keep the last sample of each stretch of
 * time, so a week or a whole war stays small.
 * @var int
 */
const STATS_MAX_POINTS = 300;

/**
 * Steam's count of players in the game right now (all shards together; Steam knows no teams).
 * @var string
 */
const STATS_STEAM_PLAYERS = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=505460';

/**
 * Whether a sample taken at a time is due again.
 *
 * @param  int $last Time of the last sample in ms, 0 for never.
 * @return bool True when STATS_INTERVAL has passed.
 */
function stats_due( int $last ) : bool
{
  return (int) round( microtime( true ) * 1000 ) - $last >= STATS_INTERVAL * 1000;
}

/**
 * Cron task: sample the war report of every hex of every live shard, every STATS_INTERVAL.
 *
 * @param  FoxholeApi $api API client.
 * @param  string     $via How the run was started, for the log: cli or url.
 * @return array<string, mixed> Per shard the number of hexes sampled, or { skipped: reason }.
 */
function stats_reports_cron( FoxholeApi $api, string $via ) : array
{
  $store = warlog_store();
  if ( !$store )
  {
    return [ 'skipped' => 'no database' ];
  }

  $result = [];
  foreach ( $api->get_shards() as $shard )
  {
    if ( !stats_due( $store->getReportTime( $shard ) ) )
    {
      continue;
    }
    $api->set_shard( $shard );
    $war = (int) ( $api->get_war()[ 'warNumber' ] ?? 0 );
    $reports = $war ? $api->async_war_reports() : [];
    if ( $reports )
    {
      $store->saveReports( $shard, $war, (int) round( microtime( true ) * 1000 ), $reports );
    }
    $result[ $shard ] = count( $reports );
    log_line( CRON_LOG, "{$via}: {$shard}: war reports of " . count( $reports ) . ' hexes' );
  }
  return $result ?: [ 'skipped' => 'sampled less than ' . STATS_INTERVAL . 's ago' ];
}

/**
 * Statistics of a shard's current war for /api/stats: totals over time, casualties per hex in
 * the last hour and day, when each hex last changed, and players and viewers over time. Never
 * throws.
 *
 * @param  string $shard Shard name.
 * @param  int    $hours How far back the series go, 1 to 168, or STATS_WHOLE_WAR for since the
 *                       first sample of the war.
 * @return array<string, mixed> { war, now, from, series, hexes, changed, players, viewers }, or
 *                              [] without data.
 */
function stats_summary( string $shard, int $hours ) : array
{
  try
  {
    $store = warlog_store();
    $status = $store ? $store->getStatus( $shard ) : [];
    if ( !$status )
    {
      return [];
    }

    $war = (int) $status[ 'war' ];
    $now = (int) round( microtime( true ) * 1000 );
    $from = $hours === STATS_WHOLE_WAR
      ? ( $store->getReportStart( $shard, $war ) ?: $now - 3600 * 1000 )
      : $now - min( 168, max( 1, $hours ) ) * 3600 * 1000;
    $latest = $store->getReportsAt( $shard, $war, $now );
    $hour_ago = $store->getReportsAt( $shard, $war, $now - 3600 * 1000 );
    $day_ago = $store->getReportsAt( $shard, $war, $now - 86400 * 1000 );

    // casualties per team since a moment; with less recorded, since recording started
    $since = fn( array $then, string $hex ) : array => [
      'wardens'   => max( 0, $latest[ $hex ][ 'wardens' ] - ( $then[ $hex ][ 'wardens' ] ?? $latest[ $hex ][ 'wardens' ] ) ),
      'colonials' => max( 0, $latest[ $hex ][ 'colonials' ] - ( $then[ $hex ][ 'colonials' ] ?? $latest[ $hex ][ 'colonials' ] ) ),
      'from'      => (int) ( $then[ $hex ][ 'time' ] ?? $latest[ $hex ][ 'time' ] )
    ];

    $hexes = [];
    foreach ( array_keys( $latest ) as $hex )
    {
      $hexes[ $hex ] = [ 'hour' => $since( $hour_ago, $hex ), 'day' => $since( $day_ago, $hex ) ];
    }

    return [
      'war'     => $war,
      'now'     => $now,
      // start of the series, the same for all of them
      'from'    => $from,
      // [ time, wardens casualties, colonials casualties, enlistments ], totals so far this war
      'series'  => stats_thin( $store->getReportSeries( $shard, $war, $from ), $from, $now ),
      'hexes'   => $hexes,
      'changed' => $store->getLastChanges( $shard, $war ),
      // [ time, players in the game ]
      'players' => stats_thin( $store->getCountSeries( WarlogStore::PLAYERS, $from ), $from, $now ),
      // [ time, viewers of F.A.T.T. in the ANALYTICS_ACTIVE_MINUTES before ]
      'viewers' => stats_thin( $store->getCountSeries( WarlogStore::VIEWERS, $from ), $from, $now )
    ];
  }
  catch ( Throwable $e )
  {
    error_log( 'Statistics unavailable: ' . $e->getMessage() );
    return [];
  }
}

/**
 * At most STATS_MAX_POINTS samples of a series: the time is cut into that many equal stretches
 * and the last sample of each is kept, so the newest sample always stays. Series that are short
 * enough are returned as they are.
 *
 * @param  array<int, array<int, int>> $series Samples [ time, ...values ], oldest first.
 * @param  int                         $from   Start of the span in ms.
 * @param  int                         $to     End of the span in ms.
 * @return array<int, array<int, int>> The kept samples, oldest first.
 */
function stats_thin( array $series, int $from, int $to ) : array
{
  $step = (int) ceil( max( 1, $to - $from ) / STATS_MAX_POINTS );
  if ( count( $series ) <= STATS_MAX_POINTS )
  {
    return $series;
  }

  $kept = [];
  foreach ( $series as $sample )
  {
    $kept[ intdiv( max( 0, $sample[ 0 ] - $from ), $step ) ] = $sample;
  }
  return array_values( $kept );
}

/**
 * The last sampled player count, for /api/players. When the cron job has not sampled for
 * twice STATS_INTERVAL, the request samples it itself. Never throws.
 *
 * @return array{time: int, count: int} Sample time in ms and players; 0 and 0 when unknown.
 */
function stats_players() : array
{
  try
  {
    $store = warlog_store();
    if ( !$store )
    {
      return [ 'time' => 0, 'count' => 0 ];
    }
    $players = $store->getCount( WarlogStore::PLAYERS );
    if ( (int) round( microtime( true ) * 1000 ) - $players[ 'time' ] > 2 * STATS_INTERVAL * 1000 )
    {
      stats_players_cron( 'request' );
      $players = $store->getCount( WarlogStore::PLAYERS );
    }
    return $players;
  }
  catch ( Throwable $e )
  {
    error_log( 'Player count unavailable: ' . $e->getMessage() );
    return [ 'time' => 0, 'count' => 0 ];
  }
}

/**
 * Cron task: sample the number of players in the game from Steam, every STATS_INTERVAL.
 *
 * @param  string $via How the run was started, for the log: cli or url.
 * @return array<string, mixed> { players } or { skipped: reason }.
 */
function stats_players_cron( string $via ) : array
{
  $store = warlog_store();
  if ( !$store )
  {
    return [ 'skipped' => 'no database' ];
  }
  if ( !stats_due( $store->getCount( WarlogStore::PLAYERS )[ 'time' ] ) )
  {
    return [ 'skipped' => 'sampled less than ' . STATS_INTERVAL . 's ago' ];
  }

  $response = ( new Client( [ 'timeout' => 5 ] ) )->get( STATS_STEAM_PLAYERS );
  $body = json_decode( (string) $response->getBody(), true );
  $count = (int) ( $body[ 'response' ][ 'player_count' ] ?? 0 );
  if ( !$count )
  {
    return [ 'skipped' => 'Steam sent no player count' ];
  }

  $store->saveCount( WarlogStore::PLAYERS, (int) round( microtime( true ) * 1000 ), $count );
  log_line( CRON_LOG, "{$via}: {$count} players" );
  return [ 'players' => $count ];
}

/**
 * Cron task: sample the viewers of F.A.T.T. from Matomo, every STATS_INTERVAL. Skipped without
 * the Matomo settings and token (lib/analytics.php).
 *
 * @param  string $via How the run was started, for the log: cli or url.
 * @return array<string, mixed> { viewers } or { skipped: reason }.
 */
function stats_viewers_cron( string $via ) : array
{
  $store = warlog_store();
  if ( !$store )
  {
    return [ 'skipped' => 'no database' ];
  }
  if ( !stats_due( $store->getCount( WarlogStore::VIEWERS )[ 'time' ] ) )
  {
    return [ 'skipped' => 'sampled less than ' . STATS_INTERVAL . 's ago' ];
  }

  $active = analytics_active();
  if ( !$active )
  {
    return [ 'skipped' => 'no Matomo token or no answer' ];
  }

  $store->saveCount( WarlogStore::VIEWERS, (int) round( microtime( true ) * 1000 ), $active[ 'count' ] );
  log_line( CRON_LOG, "{$via}: {$active[ 'count' ]} viewers" );
  return [ 'viewers' => $active[ 'count' ] ];
}
