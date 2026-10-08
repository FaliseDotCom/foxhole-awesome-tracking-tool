<?php

/**
 * Visitor statistics with Matomo: where the browser sends them, from the server settings
 * (lib/env.php). Without valid settings nothing is tracked. See the README, "Visitor statistics".
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
