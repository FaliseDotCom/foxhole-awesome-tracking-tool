<?php

  /**
   * Router for the PHP development server, mirroring the web root .htaccess. Run it from the
   * repository root:
   *
   *   php -S 127.0.0.1:8090 .api/router.php
   */

  $path = (string) parse_url( $_SERVER[ 'REQUEST_URI' ] ?? '/', PHP_URL_PATH );

  // /api/<route> goes to the API front controller
  if ( preg_match( '#^/api(?:/(.*))?$#', $path, $matches ) )
  {
    $_GET[ 'route' ] = $matches[ 1 ] ?? '';
    require __DIR__ . '/index.php';
    return true;
  }

  // dot files, dot folders, and repository files are never served
  $hidden = preg_match( '#(^|/)\.#', $path ) && !str_starts_with( $path, '/.well-known/' );
  if ( $hidden || in_array( $path, [ '/README.md', '/LICENSE' ], true ) )
  {
    http_response_code( 404 );
    return true;
  }

  // let the built-in server serve existing files, everything else is the single page app
  $root = dirname( __DIR__ );
  if ( $path !== '/' && is_file( $root . $path ) )
  {
    return false;
  }

  readfile( $root . '/index.html' );
  return true;
