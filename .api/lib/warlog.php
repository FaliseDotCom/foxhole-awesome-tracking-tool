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
    'required'  => $int( $row[ 'required' ] )
  ];
}
