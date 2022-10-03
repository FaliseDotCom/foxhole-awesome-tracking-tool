<?php

/**
 * API endpoints root
 * Live-1 : https://war-service-live.foxholeservices.com/api
 * Live-2 : https://war-service-live-2.foxholeservices.com/api
 */
define( 'FOXHOLE_API_URL', 'https://war-service-live.foxholeservices.com/api/' );

// dirs
define( 'LOG_DIR',    __DIR__ . '/logs/' );
define( 'CACHE_DIR',  __DIR__ . '/cache/' );
define( 'ASSETS_DIR', __DIR__ . '/assets/' );

// list of IP addresses
define( 'ALLOWED_IPS', [
    '87.212.241.254', // Falise HQ
    '37.247.42.245'   // this webserver
] );

define( 'PASSWORD', 'falise' );