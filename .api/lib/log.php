<?php

/**
 * Log files: one folder per day in LOG_DIR, one file per context inside it, for example
 * .logs/2026-10-07/api-error.log. Loaded before the Composer autoloader, so that even a failing
 * autoloader is logged.
 */

/**
 * Today's log folder, created when missing.
 *
 * @return string Folder path, ending in a slash.
 */
function log_dir() : string
{
  $dir = LOG_DIR . date( 'Y-m-d' ) . '/';
  if ( !is_dir( $dir ) )
  {
    @mkdir( $dir, 0755, true );
  }
  return $dir;
}

/**
 * Path of today's log file for a context.
 *
 * @param  string $name Context and kind, for example api-error or cron-record.
 * @return string File path.
 */
function log_path( string $name ) : string
{
  return log_dir() . $name . '.log';
}

/**
 * Add a line to today's log file for a context, with the time in front.
 *
 * @param  string $name Context and kind, see log_path().
 * @param  string $line Text to log.
 * @return void
 */
function log_line( string $name, string $line ) : void
{
  @file_put_contents( log_path( $name ), '[' . date( 'Y-m-d H:i:s' ) . '] ' . $line . PHP_EOL, FILE_APPEND | LOCK_EX );
}
