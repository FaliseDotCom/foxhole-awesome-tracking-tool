<?php

require_once __DIR__ . '/warlog-diff.php';
require_once __DIR__ . '/warlog-store.php';

/**
 * Records the war log on the server: compares new map data with the last snapshot and stores
 * what changed. Called by the cron job (.api/cron/record.php) and after /api/data fetches fresh
 * data. See .docs/plans/2026-10-07-war-log.md.
 */
class WarlogRecorder
{
  /**
   * Resource fields and mines: they never change in a meaningful way, so they are not logged.
   * The same ids as `resources` in .app/src/stores/icons.js.
   * @var int[]
   */
  public const RESOURCE_TYPES = [ 20, 21, 23, 32, 38, 40, 41, 61, 62 ];

  /**
   * Types whose changes are always major: keep, rocket site, relic bases, rocket states. Victory
   * towns are major through their flag. The same as `major_types` in .app/src/stores/warlog.js.
   * @var int[]
   */
  public const MAJOR_TYPES = [ 27, 37, 45, 46, 47, 70, 71, 72 ];

  /**
   * Flag bits from the War API.
   * @var int
   */
  public const VICTORY_BASE = 0x01;
  public const SCORCHED = 0x10;

  /**
   * Requests record at most this often per shard, in seconds; the cron job always records.
   * @var int
   */
  private int $min_interval = 5;

  /**
   * Event storage.
   * @var WarlogStore
   */
  private WarlogStore $store;

  /**
   * Folder for the lock files.
   * @var string
   */
  private string $lock_dir;

  /**
   * @param WarlogStore $store    Event storage.
   * @param string      $lock_dir Folder for the lock files.
   */
  public function __construct( WarlogStore $store, string $lock_dir )
  {
    $this->store = $store;
    $this->lock_dir = rtrim( $lock_dir, '/\\' ) . '/';
  }

  /**
   * Compare new map data with the last snapshot and store the changes.
   *
   * @param  string               $shard Shard name.
   * @param  array<string, mixed> $data  Compressed map data from FoxholeApi::async_dynamics().
   * @param  array<string, mixed> $war   War state from FoxholeApi::get_war().
   * @param  bool                 $force Record even if the last recording was moments ago (cron).
   * @return int Number of events stored; 0 when skipped or nothing changed.
   */
  public function record( string $shard, array $data, array $war, bool $force = false ) : int
  {
    $war_number = (int) ( $war[ 'warNumber' ] ?? 0 );
    if ( !$data || !$war_number )
    {
      return 0;
    }

    $status = $this->store->getStatus( $shard );
    $now = (int) round( microtime( true ) * 1000 );
    if ( !$force && $status && $now - (int) $status[ 'recorded_at' ] < $this->min_interval * 1000 )
    {
      return 0;
    }

    // another run (cron or a request) is busy with this shard: skip instead of recording twice
    $lock = fopen( $this->lock_dir . 'warlog-' . preg_replace( '/[^a-z0-9]/i', '', $shard ) . '.lock', 'c' );
    if ( !$lock || !flock( $lock, LOCK_EX | LOCK_NB ) )
    {
      return 0;
    }

    try
    {
      return $this->recordLocked( $shard, $data, $war, $war_number, $status, $now, $force ? 'cron' : 'request' );
    }
    finally
    {
      flock( $lock, LOCK_UN );
      fclose( $lock );
    }
  }

  /**
   * The recording itself, while holding the shard's lock.
   *
   * @param  string               $shard      Shard name.
   * @param  array<string, mixed> $data       Compressed map data.
   * @param  array<string, mixed> $war        War state.
   * @param  int                  $war_number War number.
   * @param  array<string, mixed> $status     Recording status before this run.
   * @param  int                  $now        Current time in ms.
   * @param  string               $trigger    Who recorded: cron (the cron job) or request (a visitor).
   * @return int Number of events stored.
   */
  private function recordLocked( string $shard, array $data, array $war, int $war_number, array $status, int $now, string $trigger ) : int
  {
    $totals = $this->countVictoryTowns( $data );
    $required = max( 0, (int) ( $war[ 'requiredVictoryTowns' ] ?? 0 ) - $totals[ 'scorched' ] );
    $winner = ( $war[ 'winner' ] ?? 'NONE' ) !== 'NONE' ? (string) $war[ 'winner' ] : '';
    $new_war = !$status || (int) $status[ 'war' ] !== $war_number;
    $events = [];

    $this->store->transaction( function () use ( $shard, $data, $war_number, $status, $now, $totals, $required, $winner, $new_war, $trigger, &$events )
    {
      // a new war (or the first run) only sets the starting point
      if ( $new_war )
      {
        $this->store->clearSnapshots( $shard );
      }
      $snapshots = $new_war ? [] : $this->store->getSnapshots( $shard );

      foreach ( $data as $hex => $hex_data )
      {
        if ( !isset( $hex_data[ 'd' ] ) || !is_array( $hex_data[ 'd' ] ) )
        {
          continue;
        }
        $version = (int) ( $hex_data[ 'v' ] ?? 0 );
        $before = $snapshots[ $hex ] ?? null;
        if ( $before && $before[ 'version' ] === $version )
        {
          continue;
        }

        if ( $before )
        {
          foreach ( WarlogDiff::diff( $before[ 'items' ], $hex_data[ 'd' ], self::RESOURCE_TYPES ) as $change )
          {
            $events[] = $this->toEvent( $shard, $war_number, (string) $hex, (int) ( $hex_data[ 'l' ] ?? $now ), $change );
          }
        }
        $this->store->saveSnapshot( $shard, (string) $hex, $version, $hex_data[ 'd' ] );
      }

      if ( !$new_war )
      {
        $events = array_merge( $events, $this->totalEvents( $shard, $war_number, $now, $status, $totals, $required, $winner ) );
      }
      // note who found the changes, so a missing cron job shows up in the data
      foreach ( $events as &$event )
      {
        $event[ 'recorded_by' ] = $trigger;
      }
      unset( $event );
      $this->store->addEvents( $events );
      $this->store->saveStatus( $shard, [
        'war'         => $war_number,
        'recorded_at' => $now,
        'wardens'     => $totals[ 'W' ],
        'colonials'   => $totals[ 'C' ],
        'winner'      => $winner,
        'recorded_by' => $trigger,
        'cron_at'     => $trigger === 'cron' ? $now : ( $status[ 'cron_at' ] ?? null )
      ] );
    } );

    return count( $events );
  }

  /**
   * Victory towns per team, and scorched ones, counted from the map data.
   *
   * @param  array<string, mixed> $data Compressed map data.
   * @return array<string, int> W, C and scorched.
   */
  private function countVictoryTowns( array $data ) : array
  {
    $count = [ 'W' => 0, 'C' => 0, 'scorched' => 0 ];
    foreach ( $data as $hex_data )
    {
      $count[ 'scorched' ] += (int) ( $hex_data[ 's' ] ?? 0 );
      foreach ( $hex_data[ 'd' ] ?? [] as $item )
      {
        if ( !( $item[ 'f' ] & self::VICTORY_BASE ) || ( $item[ 'f' ] & self::SCORCHED ) )
        {
          continue;
        }
        if ( isset( $count[ $item[ 't' ] ] ) )
        {
          $count[ $item[ 't' ] ]++;
        }
      }
    }
    return $count;
  }

  /**
   * Events for changed victory town totals and a newly decided winner.
   *
   * @param  string               $shard    Shard name.
   * @param  int                  $war      War number.
   * @param  int                  $now      Current time in ms.
   * @param  array<string, mixed> $status   Recording status before this run.
   * @param  array<string, int>   $totals   Victory towns per team.
   * @param  int                  $required Victory towns needed.
   * @param  string               $winner   Winning team id from the War API, or empty.
   * @return array<int, array<string, mixed>> Events.
   */
  private function totalEvents( string $shard, int $war, int $now, array $status, array $totals, int $required, string $winner ) : array
  {
    $events = [];
    foreach ( [ 'W' => 'wardens', 'C' => 'colonials' ] as $team => $column )
    {
      if ( (int) $status[ $column ] === $totals[ $team ] )
      {
        continue;
      }
      $events[] = [
        'shard' => $shard, 'war' => $war, 'time' => $now, 'hex' => '', 'kind' => 'victory', 'major' => 1,
        'team' => $team, 'value' => $totals[ $team ], 'required' => $required
      ];
    }
    if ( $winner && !$status[ 'winner' ] )
    {
      $events[] = [
        'shard' => $shard, 'war' => $war, 'time' => $now, 'hex' => '', 'kind' => 'won', 'major' => 1,
        'team' => substr( $winner, 0, 1 )
      ];
    }
    return $events;
  }

  /**
   * Turn a change from WarlogDiff into an event row.
   *
   * @param  string               $shard  Shard name.
   * @param  int                  $war    War number.
   * @param  string               $hex    Hex name as the API proxy sends it.
   * @param  int                  $time   When the War API says the hex changed, in ms.
   * @param  array<string, mixed> $change Change from WarlogDiff::diff().
   * @return array<string, mixed> Event row.
   */
  private function toEvent( string $shard, int $war, string $hex, int $time, array $change ) : array
  {
    $item = $change[ 'item' ];
    $previous = $change[ 'previous' ];
    return [
      'shard'      => $shard,
      'war'        => $war,
      'time'       => $time,
      'hex'        => $hex,
      'kind'       => $change[ 'kind' ],
      'major'      => $this->isMajor( $item ) || ( $previous && $this->isMajor( $previous ) ) ? 1 : 0,
      'icon'       => $item[ 'i' ],
      'icon_from'  => $previous[ 'i' ] ?? null,
      'team'       => $item[ 't' ],
      'team_from'  => $previous[ 't' ] ?? null,
      'flags'      => $item[ 'f' ],
      'flags_from' => $previous[ 'f' ] ?? null,
      'x'          => $item[ 'x' ],
      'y'          => $item[ 'y' ]
    ];
  }

  /**
   * Whether a change to this item is major.
   *
   * @param  array<string, mixed> $item Map item.
   * @return bool True for victory towns, relic bases, keeps and rockets.
   */
  private function isMajor( array $item ) : bool
  {
    return ( $item[ 'f' ] & self::VICTORY_BASE ) || in_array( (int) $item[ 'i' ], self::MAJOR_TYPES, true );
  }
}
