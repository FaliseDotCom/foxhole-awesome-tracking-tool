<?php

use GuzzleHttp\Client;
use Katzgrau\KLogger\Logger;
use Psr\Log\LogLevel;

/**
 * Foxhole API class
 * See https://github.com/clapfoot/warapi for details
 */
class FoxholeApi
{
  // File logger instance
  private $logger;

  // Guzzle client instance
  private $client = null;

  // File cache instance
  private $cache = null;

  // Cache key prefix for making things unique to this class
  private $cache_prefix = 'foxhole';

  // Default cache duration = 24 hours
  private $cache_duration = 24 * 60 * 60;

  /**
   * API roots
   * Live-1 / Able  : https://war-service-live.foxholeservices.com/api/
   * Live-2 / Baker : https://war-service-live-2.foxholeservices.com/api/
   * Live-3 / Dev   : https://war-service-live-2.foxholeservices.com/api/
   */
  private $shards = [
    'able'  => 'https://war-service-live.foxholeservices.com/api/',
    'baker' => 'https://war-service-live-2.foxholeservices.com/api/',
    'dev'   => 'https://war-service-live-3.foxholeservices.com/api/'
  ];

  private $shard = 'able';

  // class constructor
  function __construct()
  {
    // init file cache
    $this->cache = new Cache( 'foxhole' );

    // init logger
    $this->logger = new Logger(
      // log file directory
      LOG_DIR,
      // minimal log level
      LogLevel::DEBUG,
      // daily logfile specific for this class
      [ 'filename' => 'foxhole-' . date( 'Y-m-d' ) . '.log' ]
    );

    // maybe overwrite api url from config
    if ( defined( 'FOXHOLE_API_URL' ) && FOXHOLE_API_URL)
    {
      $this->api_url = FOXHOLE_API_URL;
    }

    // init guzzle client by setting a shard
    $this->set_shard();
  }

  /**
   * Get a list of shards / server names
   * @return [type] [description]
   */
  public function get_shards()
  {
    return array_keys( $this->shards );
  }

  /**
   * Set shard / server name
   * @param string $shard [description]
   */
  public function set_shard( string $shard = '' )
  {
    // save shard
    $this->shard = isset( $this->shards[ $shard ] ) ? $shard : array_keys( $this->shards )[ 0 ];

    // (re)init guzzle client
    $this->client = new GuzzleHttp\Client( [
      'base_uri' => $this->shards[ $this->shard ]
    ] );
  }

  /**
   * Get wrapper that returns array of results
   * @param  string $what
   * @return [type]       [description]
   */
  public function get( string $what = '', int $cache_duration = 0, bool $force = false ) : array
  {
    $key = $this->shard . '-' . $what;
    $data = $this->getCache( $key );
    if ( !$data || $force )
    {
      $response = $this->client->get( $what );
      $body = $response->getBody();
      $data = json_decode( $body, true );
      $this->saveCache( $key, $data, $cache_duration );
    }
    return $data ?: array();
  }

  /**
   * Get cache by key
   * @param  string $key [description]
   * @return [type]      [description]
   */
  private function getCache( string $key )
  {
    $key = $this->cache_prefix . '-' . $key;
    try
    {
      return $this->cache->get( $key );
    }
    catch( exception $e )
    {
      $this->logger->error( 'getCache failed for ' . $key . ', error: ' . $e->getMessage() );
    }
    return [];
  }

  /**
   * Store data in cache
   * @param  string      $key      [description]
   * @param  array       $data     [description]
   * @param  int|integer $duration [description]
   * @return [type]                [description]
   */
  private function saveCache( string $key, $data, int $duration = 0 )
  {
    $this->cache->save( $this->cache_prefix . '-' . $key, $data, $duration ?: $this->cache_duration );
  }

  /**
   * Get a list of maps
   * @return [type] [description]
   */
  public function get_map_list()
  {
    return $this->get( 'worldconquest/maps' );
  }

  /**
   * Get static map stuff for one area
   * @param  string $map [description]
   * @return [type]      [description]
   */
  public function get_static_map( string $map )
  {
    return $this->get( 'worldconquest/maps/' . $map . '/static' );
  }

  /**
   * Get Dynamic map stuff for one area
   * @param  string $map [description]
   * @return [type]      [description]
   */
  public function get_dynamic_map( string $map )
  {
    // get dynamic map stuff, cache for 5 minutes
    return $this->get( 'worldconquest/maps/' . $map . '/dynamic/public', 5 * 60 );
  }

  /**
   * Cleanup map name
   * @param  string $name [description]
   * @return [type]       [description]
   */
  public function map_name( string $name )
  {
    return str_replace( 'Hex', '', $name );
  }

  /**
   * Convert map name to title
   * @param  string $name [description]
   * @return [type]       [description]
   */
  public function map_title( string $name )
  {
    return trim( join( ' ', preg_split('/(?=[A-Z])/', $this->map_name( $name ) ) ) );
  }

  /**
   * Get stuff for entire map
   * @return [type]      [description]
   */
  public function get_map()
  {
    // first try to get data from cache
    $key = 'entire-map';
    $data = $this->getCache( $key );
    if ( $data ) return $data;

    // otherwise build from scratch
    $data = [];

    // get map names and go over each
    $maps = $this->get_map_list();
    foreach ( $maps as $name)
    {
      // get static stuff
      $map = $this->get_static_map( $name );

      // store original name
      $map[ 'hex' ] = $name;

      // clean up name
      $name = $this->map_name( $name );

      // add some custom stuff
      $map[ 'title' ] = $this->map_title( $name );
      $map[ 'name' ] = $name;

      // add it to the array
      $data[ $name ] = $map;
    }

    // store in cache for 5 minutes and return data
    $this->saveCache( $key, $data, 5 * 60 );
    return $data;
  }



  /**
   * Remove compression postfix from map file names
   * @return [type] [description]
   */
  public function clear_map_files()
  {
    $dir = ASSETS_DIR . 'images/maps/';
    $objects = scandir( $dir );
    foreach ( $objects as $object )
    {
      if ( $object != "." && $object != ".." && !is_dir( $object ) )
      {
        $name = str_replace( '-fs8', '', $object );
        $name = str_replace( '-or8', '', $name );
        if ( $name !== $object )
        {
          // if new filename already exists, keep the smallest
          if ( file_exists( $dir . $name ) )
          {
            $new_size = filesize( $dir . $object );
            $old_size = filesize( $dir . $name );

            // if the existing file is smaller, remove the file currently being processed
            if ( $old_size < $new_size )
            {
              unlink( $dir . $object );
              // continue to the next item in the loop
              continue;
            }
          }

          // rename file, overwrites existing files! @ to prevent non existing renames throwing errors
          @rename( $dir . $object, $dir . $name );
        }
      }
    }
  }
}
