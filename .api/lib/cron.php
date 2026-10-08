<?php

/**
 * Scheduled work, run every 15 seconds by four cron jobs a minute (see the README): from the
 * command line (cron/record.php) or by requesting /api/cron. Each run does every task in cron_tasks(); add new tasks there.
 */

/**
 * Runs closer together than this are skipped, in seconds: /api/cron is public, so this keeps
 * anyone from making the server do the tasks (and fetch the War API) more often than cron would.
 * @var int
 */
const CRON_INTERVAL = 10;

/**
 * The tasks of a cron run, by name; the name is also the key of the task's result.
 *
 * @return array<string, callable(FoxholeApi, string): array<mixed>> Task callbacks, each given
 *   the API client and how the run was started.
 */
function cron_tasks() : array
{
  return [
    // record the war log (and the history of every hex) of every live shard
    'warlog'  => fn( FoxholeApi $api, string $via ) : array => warlog_cron( $api, $via ),
    // every 5 minutes: casualties per hex, and the players in the game
    'reports' => fn( FoxholeApi $api, string $via ) : array => stats_reports_cron( $api, $via ),
    'players' => fn( FoxholeApi $api, string $via ) : array => stats_players_cron( $via )
  ];
}

/**
 * One cron run: every task in turn, reported in cron-record.log. A failing task does not stop
 * the others.
 *
 * @param  FoxholeApi $api API client.
 * @param  string     $via How the run was started, for the log: cli or url.
 * @return array<string, mixed> { skipped: reason } or the result of each task by name;
 *   { error: message } for a task that failed.
 */
function cron_run( FoxholeApi $api, string $via ) : array
{
  $skipped = cron_claim();
  if ( $skipped )
  {
    log_line( CRON_LOG, "{$via}: skipped, {$skipped}" );
    return [ 'skipped' => $skipped ];
  }

  $results = [];
  foreach ( cron_tasks() as $name => $task )
  {
    try
    {
      $results[ $name ] = $task( $api, $via );
    }
    catch ( Throwable $e )
    {
      error_log( "Cron task {$name} failed: " . $e->getMessage() );
      log_line( CRON_LOG, "{$via}: {$name} failed, see the error log" );
      $results[ $name ] = [ 'error' => $e->getMessage() ];
    }
  }
  return $results;
}

/**
 * Claim this cron run: note its start time, unless a run started too recently or is still busy.
 *
 * @return string Why the run must be skipped, or '' to go ahead.
 */
function cron_claim() : string
{
  if ( !is_dir( DATA_DIR ) )
  {
    @mkdir( DATA_DIR, 0755, true );
  }
  $file = @fopen( DATA_DIR . 'cron-last.txt', 'c+' );
  if ( !$file )
  {
    return 'cannot write ' . DATA_DIR;
  }

  try
  {
    if ( !flock( $file, LOCK_EX | LOCK_NB ) )
    {
      return 'another run is busy';
    }
    $ago = time() - (int) stream_get_contents( $file );
    if ( $ago < CRON_INTERVAL )
    {
      return "the last run started {$ago}s ago";
    }
    ftruncate( $file, 0 );
    rewind( $file );
    fwrite( $file, (string) time() );
    return '';
  }
  finally
  {
    flock( $file, LOCK_UN );
    fclose( $file );
  }
}
