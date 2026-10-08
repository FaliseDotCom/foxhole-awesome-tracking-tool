<?php

/**
 * Watches the War API for changes that F.A.T.T. may need to follow: hexes, icon types and map
 * flag bits it has not seen before, or hexes that are gone. The first run notes what exists
 * (the baseline); after that every newcomer is stored, logged in api-changes.log, and listed
 * by /api/health, which a daily GitHub Action checks.
 */

/**
 * Log of the changes found.
 * @var string
 */
const WATCH_LOG = 'api-changes';

/**
 * How long a change stays listed by /api/health, in days.
 * @var int
 */
const WATCH_DAYS = 30;

/**
 * Cron task: compare the latest map data of every live shard with what was seen before.
 *
 * @param  FoxholeApi $api API client.
 * @param  string     $via How the run was started, for the log: cli or url.
 * @return array<string, mixed> { new: number of newcomers } or { skipped: reason }.
 */
function watch_cron( FoxholeApi $api, string $via ) : array
{
  $store = warlog_store();
  if ( !$store )
  {
    return [ 'skipped' => 'no database' ];
  }

  $seen = [ 'hex' => [], 'icon' => [], 'flag' => [] ];
  foreach ( $api->get_shards() as $shard )
  {
    // the map data the warlog task stored moments ago: no extra War API requests
    foreach ( warlog_latest( $shard ) as $hex => $hex_data )
    {
      $seen[ 'hex' ][ (string) $hex ] = true;
      foreach ( $hex_data[ 'd' ] ?? [] as $item )
      {
        $seen[ 'icon' ][ (string) $item[ 'i' ] ] = true;
        for ( $bit = 1; $bit <= (int) $item[ 'f' ]; $bit <<= 1 )
        {
          if ( $item[ 'f' ] & $bit )
          {
            $seen[ 'flag' ][ sprintf( '0x%02x', $bit ) ] = true;
          }
        }
      }
    }
  }
  if ( !$seen[ 'hex' ] )
  {
    return [ 'skipped' => 'no map data' ];
  }

  $new = 0;
  foreach ( $seen as $kind => $values )
  {
    $known = $store->getSeen( $kind );
    // the first time a kind is watched, everything there is the baseline
    $baseline = !$known;
    foreach ( array_keys( $values ) as $value )
    {
      if ( isset( $known[ (string) $value ] ) )
      {
        continue;
      }
      $store->addSeen( $kind, (string) $value, $baseline );
      if ( !$baseline )
      {
        $new++;
        log_line( WATCH_LOG, "{$via}: new {$kind} {$value}" );
      }
    }
  }

  // hexes that were there before and are not now (one live shard is enough to see them)
  foreach ( array_diff_key( $store->getSeen( 'hex' ), $seen[ 'hex' ] ) as $hex => $first_seen )
  {
    if ( $store->addSeen( 'gone-hex', (string) $hex, false ) )
    {
      $new++;
      log_line( WATCH_LOG, "{$via}: hex {$hex} is gone" );
    }
  }

  return [ 'new' => $new ];
}

/**
 * State of the site for /api/health: whether the cron job runs, and the War API changes found
 * in the last WATCH_DAYS days. Never throws.
 *
 * @param  FoxholeApi $api API client.
 * @return array<string, mixed> { ok, now, cronAt, shards, changes }.
 */
function watch_health( FoxholeApi $api ) : array
{
  $now = (int) round( microtime( true ) * 1000 );
  try
  {
    $store = warlog_store();
    $shards = $api->get_shards();
    $cron_at = 0;
    foreach ( $shards as $shard )
    {
      $cron_at = max( $cron_at, (int) ( $store ? ( $store->getStatus( $shard )[ 'cron_at' ] ?? 0 ) : 0 ) );
    }
    $changes = $store ? $store->getChanges( $now - WATCH_DAYS * 86400 * 1000 ) : [];
    return [
      // healthy: the cron job ran in the last 5 minutes; changes are listed apart
      'ok'      => $now - $cron_at < 5 * 60 * 1000,
      'now'     => $now,
      'cronAt'  => $cron_at,
      'shards'  => $shards,
      'changes' => $changes
    ];
  }
  catch ( Throwable $e )
  {
    error_log( 'Health check failed: ' . $e->getMessage() );
    return [ 'ok' => false, 'now' => $now, 'cronAt' => 0, 'shards' => [], 'changes' => [], 'error' => 'health check failed' ];
  }
}
