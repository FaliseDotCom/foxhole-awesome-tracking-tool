<?php

use GuzzleHttp\Client;

/**
 * Visitor statistics with Matomo: where the browser sends them, from the server settings
 * (lib/env.php), and how many are watching, for the Stats tab. Without valid settings nothing
 * is tracked. See the README, "Visitor statistics".
 */

/**
 * Server setting with the Matomo address, such as https://matomo.fali.se/.
 * @var string
 */
const ANALYTICS_URL = 'MATOMO_URL';

/**
 * Server setting with the site id of F.A.T.T. in Matomo.
 * @var string
 */
const ANALYTICS_SITE = 'MATOMO_SITE_ID';

/**
 * Server setting with the token of a Matomo user that may view F.A.T.T., for the number of
 * viewers. Never sent to the browser.
 * @var string
 */
const ANALYTICS_TOKEN = 'MATOMO_TOKEN';

/**
 * A viewer counts as watching when the page sent something (a ping, every minute while it is
 * visible) in this many minutes.
 * @var int
 */
const ANALYTICS_ACTIVE_MINUTES = 5;

/**
 * Where the browser sends visitor statistics.
 *
 * @return array{ url?: string, site?: int } The Matomo address (https, ending in a slash) and the
 *                                            site id, or an empty array when tracking is off.
 */
function analytics_config() : array
{
  $url = env( ANALYTICS_URL );
  $site = (int) env( ANALYTICS_SITE );

  if ( $site < 1 || !filter_var( $url, FILTER_VALIDATE_URL ) || !str_starts_with( $url, 'https://' ) )
  {
    return [];
  }

  return [ 'url' => rtrim( $url, '/' ) . '/', 'site' => $site ];
}

/**
 * How many people are watching F.A.T.T.: the visitors Matomo saw in the last
 * ANALYTICS_ACTIVE_MINUTES. Never throws.
 *
 * @return array{time?: int, count?: int} Time in ms and the number of visitors, or an empty array
 *                                        without settings and token, or when Matomo does not answer.
 */
function analytics_active() : array
{
  $config = analytics_config();
  $token = env( ANALYTICS_TOKEN );
  if ( !$config || $token === '' )
  {
    return [];
  }

  try
  {
    // the token goes in the body, never in the address
    $response = ( new Client( [ 'timeout' => 5 ] ) )->post( $config[ 'url' ] . 'index.php', [
      'form_params' => [
        'module'      => 'API',
        'method'      => 'Live.getCounters',
        'idSite'      => $config[ 'site' ],
        'lastMinutes' => ANALYTICS_ACTIVE_MINUTES,
        'format'      => 'JSON',
        'token_auth'  => $token
      ]
    ] );
    $body = json_decode( (string) $response->getBody(), true );
  }
  catch ( Throwable $e )
  {
    error_log( 'Matomo unavailable: ' . $e->getMessage() );
    return [];
  }

  // [ { visits, actions, visitors, visitsConverted } ], or { result: error, message }
  if ( !is_array( $body ) || !isset( $body[ 0 ][ 'visitors' ] ) )
  {
    error_log( 'Matomo sent no viewer count: ' . ( is_array( $body ) ? (string) ( $body[ 'message' ] ?? 'unexpected answer' ) : 'no JSON' ) );
    return [];
  }

  return [ 'time' => (int) round( microtime( true ) * 1000 ), 'count' => (int) $body[ 0 ][ 'visitors' ] ];
}
