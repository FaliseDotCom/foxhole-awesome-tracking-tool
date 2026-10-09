<?php

/**
 * Viewers of F.A.T.T.: while a map is open and visible, its requests for map data carry a random
 * id (X-Fatt-Viewer), one per browser while it is in use (.app/src/lib/viewer-id.js). The server
 * keeps only when it last saw each id, counts the ids seen in the last VIEWERS_ACTIVE_MINUTES,
 * and forgets older ones when the cron job samples the count (stats.php).
 */

/**
 * The viewer id header as PHP names it in $_SERVER (X-Fatt-Viewer).
 * @var string
 */
const VIEWERS_HEADER = 'HTTP_X_FATT_VIEWER';

/**
 * A viewer counts as watching when its map asked for data in this many minutes.
 * @var int
 */
const VIEWERS_ACTIVE_MINUTES = 5;

/**
 * Note that the viewer of this request is watching. Requests without a valid id are not
 * counted. Never throws: a failing count must not break the map.
 *
 * @return void
 */
function viewers_seen() : void
{
  $id = (string) ( $_SERVER[ VIEWERS_HEADER ] ?? '' );
  if ( !preg_match( '/^[0-9a-f]{16,64}$/', $id ) )
  {
    return;
  }

  try
  {
    warlog_store()?->seeViewer( $id, (int) round( microtime( true ) * 1000 ) );
  }
  catch ( Throwable $e )
  {
    error_log( 'Viewer not counted: ' . $e->getMessage() );
  }
}

/**
 * From when a viewer seen counts as watching now.
 *
 * @param  int $now The moment in ms.
 * @return int Time in ms.
 */
function viewers_active_since( int $now ) : int
{
  return $now - VIEWERS_ACTIVE_MINUTES * 60 * 1000;
}
