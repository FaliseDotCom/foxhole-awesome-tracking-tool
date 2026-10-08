<?php

require_once __DIR__ . '/warlog-recorder.php';

/**
 * Entry points for the server-side war log, shared by the API (index.php) and the cron job
 * (cron/record.php).
 */

/**
 * Open the war log database.
 *
 * @return WarlogStore|null The store, or null when SQLite is unavailable (the log is then off
 *   and browsers fall back to their own comparison).
 */
function warlog_store() : ?WarlogStore
{
  try
  {
    return new WarlogStore( DATA_DIR . 'warlog.sqlite' );
  }
  catch ( Throwable $e )
  {
    error_log( 'War log storage unavailable: ' . $e->getMessage() );
    return null;
  }
}

/**
 * Record changes in fresh map data. Never throws: a failing war log must not break the map.
 *
 * @param  FoxholeApi           $api   API client, set to the shard.
 * @param  string               $shard Shard name.
 * @param  array<string, mixed> $data  Compressed map data from async_dynamics().
 * @param  bool                 $force Record even if the last recording was moments ago.
 * @return int Number of events stored.
 */
function warlog_record( FoxholeApi $api, string $shard, array $data, bool $force = false ) : int
{
  try
  {
    $store = warlog_store();
    if ( !$store )
    {
      return 0;
    }
    return ( new WarlogRecorder( $store, DATA_DIR ) )->record( $shard, $data, $api->get_war(), $force );
  }
  catch ( Throwable $e )
  {
    error_log( 'War log recording failed: ' . $e->getMessage() );
    return 0;
  }
}

/**
 * Cron task (see cron.php): record every live shard as the cron job, and report each shard in
 * cron-record.log.
 *
 * @param  FoxholeApi $api API client.
 * @param  string     $via How the run was started, for the log: cli or url.
 * @return array<string, array{events: int, hexes: int}> Per shard; events is -1 when it failed.
 */
function warlog_cron( FoxholeApi $api, string $via ) : array
{
  $shards = $api->get_shards();
  if ( !$shards )
  {
    // no shard answered, or the War API is unreachable from here (a missing CA bundle shows up so)
    log_line( CRON_LOG, "{$via}: no live shards found, nothing recorded" );
  }

  $result = [];
  foreach ( $shards as $shard )
  {
    try
    {
      $api->set_shard( $shard );
      $data = $api->async_dynamics();
      $result[ $shard ] = [ 'events' => warlog_record( $api, $shard, $data, true ), 'hexes' => count( $data ) ];
      // the hex count shows whether map data came in at all: 0 events with 0 hexes is a failed fetch
      log_line( CRON_LOG, "{$via}: {$shard}: {$result[ $shard ][ 'events' ]} events, {$result[ $shard ][ 'hexes' ]} hexes" );
    }
    catch ( Throwable $e )
    {
      // one failing shard must not stop the others
      error_log( "War log cron failed for {$shard}: " . $e->getMessage() );
      $result[ $shard ] = [ 'events' => -1, 'hexes' => 0 ];
      log_line( CRON_LOG, "{$via}: {$shard}: failed, see the error log" );
    }
  }
  return $result;
}

/**
 * Events for the browser: names in camelCase and numbers as numbers.
 *
 * @param  array<string, mixed> $row Row from the events table.
 * @return array<string, mixed> Event.
 */
function warlog_event_json( array $row ) : array
{
  $int = fn( $value ) => $value === null ? null : (int) $value;
  return [
    'id'        => (int) $row[ 'id' ],
    'time'      => (int) $row[ 'time' ],
    'hex'       => $row[ 'hex' ],
    'kind'      => $row[ 'kind' ],
    'major'     => (bool) $row[ 'major' ],
    'icon'      => $int( $row[ 'icon' ] ),
    'iconFrom'  => $int( $row[ 'icon_from' ] ),
    'team'      => $row[ 'team' ],
    'teamFrom'  => $row[ 'team_from' ],
    'flags'     => $int( $row[ 'flags' ] ),
    'flagsFrom' => $int( $row[ 'flags_from' ] ),
    'x'         => $row[ 'x' ] === null ? null : (float) $row[ 'x' ],
    'y'         => $row[ 'y' ] === null ? null : (float) $row[ 'y' ],
    'value'     => $int( $row[ 'value' ] ),
    'required'  => $int( $row[ 'required' ] ),
    // cron or request: whether the cron job or a visitor's map update found this change
    'recordedBy' => $row[ 'recorded_by' ] ?? null
  ];
}
