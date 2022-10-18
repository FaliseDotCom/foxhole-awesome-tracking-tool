<?php

use GuzzleHttp\Client;
use GuzzleHttp\Promise;
use GuzzleHttp\HandlerStack;
use Kevinrob\GuzzleCache\CacheMiddleware;
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

  // (initial) shard name
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

    // init guzzle client by setting a shard
    $this->set_shard( $this->shard );
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
    // get data from cache
    $key = 'get-' . $this->shard . '-' . $what;
    $data = $this->getCache( $key );

    // (re)load from server when there's no data
    if ( !$data || $force )
    {
      // get a response
      $response = $this->client->get( $what );

      // get data as JSON
      $body = $response->getBody();
      $data = json_decode( $body, true );

      // store in cache
      $this->saveCache( $key, $data, $cache_duration );
    }

    // always return an array
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
    try
    {
      $this->cache->save( $this->cache_prefix . '-' . $key, $data, $duration ?: $this->cache_duration );
    }
    catch( exception $e )
    {
      $this->logger->error( 'saveCache failed for ' . $key . ', error: ' . $e->getMessage() );
    }
  }

  /**
   * Strip private keys from data array, private keys start with __ (double underscore)
   * @param  array  $data [description]
   * @return [type]       [description]
   */
  private function strip_private_data( array $data = array() )
  {
     return array_filter( $data, function( $key ) {
        return strpos( $key, '__' ) !== 0;
    }, ARRAY_FILTER_USE_KEY );
  }

  /**
   * Get a list of maps
   * @return [type] [description]
   */
  public function get_map_list()
  {
    return $this->strip_private_data( $this->get( 'worldconquest/maps' ) );
  }

  /**
   * Get static map stuff for one area
   * @param  string $map [description]
   * @return [type]      [description]
   */
  public function get_static_map( string $map )
  {
    // store static map for 24 hours
    return $this->get( 'worldconquest/maps/' . $map . '/static', 24 * 60 * 60 );
  }

  /**
   * Get Dynamic map stuff for one area, cache for 10 seconds
   * @param  string $map [description]
   * @return [type]      [description]
   */
  public function get_dynamic_map( string $map, bool $force = false, int $cache = 10 ) : array
  {
    // try to load from cache
    $key = 'get-dynamic-map-' . $this->shard . '-' . $map;
    $data = $this->getCache( $key );
    // maybe rebuild
    if ( !$data || $force )
    {
      // get data, possibly from cache
      $data = $this->get( 'worldconquest/maps/' . $map . '/dynamic/public', $cache, $force );
      // store in cache
      $this->saveCache( $key, $data, $cache );
    }
    // return the data
    return $data;
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
   * Get static info for entire world map
   * @return [type]      [description]
   */
  public function get_static_world( bool $force = false ) : array
  {
    // first try to get data from cache
    $key = 'get-static-world';
    $data = $this->getCache( $key );
    if ( $data && !$force ) return $data;

    // otherwise build from scratch
    $data = [];

    // get map names and go over each
    $maps = $this->get_map_list();
    foreach ( $maps as $id )
    {
      $name = $this->map_name( $id );
      $data[ $name ] = $this->get_static_map( $id );
    }

    // store in cache for 24 hours
    $this->saveCache( $key, $data );
    return $data;
  }

  /**
   * Get dynamic info for entire world map
   * @return [type]      [description]
   */
  public function get_dynamic_world( bool $force = false, int $cache = 10 ) : array
  {
    // first try to get data from cache
    $key = 'get-dynamic-world-' . $this->shard;
    $data = $this->getCache( $key );
    if ( $data && !$force ) return $data;

    // otherwise build from scratch
    $data = [];

    // get map names and go over each
    $maps = $this->get_map_list();
    foreach ( $maps as $id )
    {
      $name = $this->map_name( $id );
      $data[ $name ] = $this->get_dynamic_map( $id, $force, $cache  );
    }

    // store in cache for 10 seconds
    $this->saveCache( $key, $data, $cache );
    return $data;
  }

  public function async_dynamics()
  {
    $this->logger->debug( 'Starting async' );
    $maps = $this->get_map_list();
    $promises = array();

    foreach ( $maps as $map )
    {
      $name = $this->map_name( $map );
      $promises[ $name  ] = $this->client->getAsync( 'worldconquest/maps/' . $map . '/dynamic/public' );
    }

    $data = array();
    $responses = Promise\Utils::unwrap( $promises );
    foreach ( $responses as $name => $response )
    {
      $data[ $name ] = json_decode( $response->getBody(), true );
    }
    return $data;
  }

  /**
   * Get update to a single dynamic map
   * @return [type] [description]
   */
  public function get_dynamic_map_updates( string $map = '', string $version = '', bool $force = false ) : array
  {
    // bail if we have missing params
    if ( !$map ) return array();

    // get all maps to check against
    $maps = $this->get_map_list();

    // bail if the map name is invalid
    if ( !in_array( $map, $maps ) ) return array();

    // allow force to skip etag
    $options = array();
    if ( !$force && $version )
    {
      $options = [ 'headers' => [
        'If-None-Match' => '"' . $version . '"'
      ] ];
    }

     // get a response, adding an etag means we might get statuscode 304 when nothing was changed
    $response = $this->client->get( 'worldconquest/maps/' . $map . '/dynamic/public/', $options );

    // only return data on status code 200
    if ( $response->getStatusCode() == 200 )
    {
      return json_decode( $response->getBody(), true );
    }

    // return empty array in all other cases
    return array();
  }


  /**
   * Get updates to the dynamic world map
   * @return [type] [description]
   */
  public function get_dynamic_world_updates( array $maps = array(), bool $force = false ) : array
  {
    $data = array();
    foreach ( $maps as $map => $version  )
    {
      $map_data = $this->get_dynamic_map_updates( $map, $version, $force );
      if ( $map_data )
      {
        $data[ $map ] = $map_data;
      }
    }
    return $data;
  }

  /**
   * Clean up PNG assets; remove multiple versions and keep the smallest file
   * @param  string $dir [description]
   * @return [type]      [description]
   */
  private function clean_png_assets( string $dir )
  {
    // dir MUST be inside assets
    if ( strrpos( $dir, ASSETS_DIR ) === false ) return;

    $objects = scandir( $dir );
    foreach ( $objects as $object )
    {
      if ( $object != "." && $object != ".." && !is_dir( $object ) && strpos( $object, '.png' ) !== false )
      {
        $name = str_replace( '-fs8', '', $object );
        $name = str_replace( '-or8', '', $name );
        $name = str_replace( 'MapIcon', '', $name );
        $name = strtolower( $name );
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

  /**
   * Remove compression postfix from map file names
   * @return [type] [description]
   */
  public function clean_map_assets()
  {
    $this->clean_png_assets( ASSETS_DIR . 'images/maps/' );
  }

  /**
   * Remove compression postfix from icon file names
   * @return [type] [description]
   */
  public function clean_icon_assets()
  {
    $this->clean_png_assets( ASSETS_DIR . 'images/icons/' );
  }

}
