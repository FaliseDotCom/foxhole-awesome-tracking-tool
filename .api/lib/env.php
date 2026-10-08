<?php

/**
 * Server settings from ENV_FILE (.api/.env): KEY=value lines, # for comments, values optionally
 * in quotes. The file exists only on the server and holds what must not be in the repository or
 * differs per server, such as the Matomo address. A setting that is not in the file falls back to
 * the process environment.
 */

/**
 * Read the settings in a .env file.
 *
 * @param  string $file Path of the file.
 * @return array<string, string> Values by name; empty when the file is missing or unreadable.
 */
function env_read( string $file ) : array
{
  $lines = is_readable( $file ) ? file( $file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES ) : false;
  if ( !is_array( $lines ) )
  {
    return [];
  }

  $settings = [];
  foreach ( $lines as $line )
  {
    $line = trim( $line );
    if ( $line === '' || str_starts_with( $line, '#' ) || !str_contains( $line, '=' ) )
    {
      continue;
    }

    [ $key, $value ] = array_map( 'trim', explode( '=', $line, 2 ) );
    // "value" or 'value': without the quotes
    if ( preg_match( '/^(["\'])(.*)\1$/', $value, $quoted ) )
    {
      $value = $quoted[ 2 ];
    }
    $settings[ $key ] = $value;
  }
  return $settings;
}

/**
 * Read a server setting.
 *
 * @param  string $key     Setting name, such as MATOMO_URL.
 * @param  string $default Value when the setting is missing or empty.
 * @return string The value, trimmed.
 */
function env( string $key, string $default = '' ) : string
{
  static $settings = null;
  $settings ??= env_read( ENV_FILE );

  $value = trim( (string) ( $settings[ $key ] ?? getenv( $key ) ?: '' ) );
  return $value === '' ? $default : $value;
}
