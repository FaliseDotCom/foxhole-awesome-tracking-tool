<?php

use GuzzleHttp\Client;
use GuzzleHttp\Promise\Promise;
use GuzzleHttp\Promise\Utils as PromiseUtils;
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

  // round coordinates down to some decimal
  private $coordinate_decimals = 5;

  /**
   * War API roots of the live shards, as documented at https://github.com/clapfoot/warapi.
   * The API has no endpoint that lists shards, so get_shards() checks which of these answer.
   * @var array<string, string>
   */
  private $shards = [
    'able'    => 'https://war-service-live.foxholeservices.com/api/',
    'baker'   => 'https://war-service-live-2.foxholeservices.com/api/',
    'charlie' => 'https://war-service-live-3.foxholeservices.com/api/'
  ];

  /**
   * How long the list of live shards is cached, in seconds.
   * @var int
   */
  private int $shard_check_duration = 5 * 60;

  /**
   * Seconds to wait for a shard before it counts as down.
   * @var int
   */
  private int $shard_check_timeout = 5;

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
   * Get the names of the shards whose War API currently answers, cached for a few minutes.
   * @return string[]
   */
  public function get_shards() : array
  {
    $key = 'live-shards';
    $cached = $this->getCache( $key );
    if ( is_array( $cached ) && isset( $cached[ 'names' ] ) && is_array( $cached[ 'names' ] ) )
    {
      return $cached[ 'names' ];
    }

    $names = $this->find_live_shards();
    // wrapped in an array so an empty list is still a valid cache entry
    $this->saveCache( $key, [ 'names' => $names ], $this->shard_check_duration );
    return $names;
  }

  /**
   * Ask every known shard for its war state in parallel and keep the ones that answer.
   * @return string[]
   */
  private function find_live_shards() : array
  {
    $client = new Client( [
      'timeout'     => $this->shard_check_timeout,
      'http_errors' => false
    ] );

    $promises = [];
    foreach ( $this->shards as $name => $url )
    {
      $promises[ $name ] = $client->getAsync( $url . 'worldconquest/war' );
    }

    $names = [];
    foreach ( PromiseUtils::settle( $promises )->wait() as $name => $result )
    {
      if ( $result[ 'state' ] === 'fulfilled' && $result[ 'value' ]->getStatusCode() === 200 )
      {
        $names[] = $name;
      }
    }
    return $names;
  }

  /**
   * Is this shard currently live?
   * @param  string $shard Shard name.
   * @return bool
   */
  public function is_live_shard( string $shard ) : bool
  {
    return in_array( $shard, $this->get_shards(), true );
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
   * Do an async call that maybe loads from cache
   * @param  string       $what           [description]
   * @param  int|integer  $cache_duration [description]
   * @param  bool|boolean $force          [description]
   * @return [type]                       [description]
   */
  private function get_async( string $what = '', int $cache_duration = 3, bool $force = false )
  {
    // get data from cache
    $key = 'get-async-' . $this->shard . '-' . $what;
    $data = $this->getCache( $key );

    // (re)load from server when there's no data
    if ( !$data || $force )
    {
      // get a promise
      $promise = $this->client->getAsync( $what );

      // store reponse data in cache
      $promise->then( function( $response ) use ( $key, $cache_duration )
      {
        // get data as JSON
        $body = $response->getBody();
        $data = json_decode( $body, true );

        // store in cache
        $this->saveCache( $key, $data, $cache_duration );

        // return the body
        return $data;
      } );

      return $promise;
    }
    else
    {
      $promise = new Promise(
        function () use ( &$promise, $data, $key )
        {
          // return the data
          $promise->resolve( $data );
        }
      );

      // return the promise
      return $promise;
    }
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
   * Get the state of the current war: number, start, winner and victory towns needed.
   * Cached for a minute; it only changes when a war starts or ends.
   * @return array<string, mixed>
   */
  public function get_war() : array
  {
    $war = $this->get( 'worldconquest/war', 60 );
    $keys = [ 'warNumber', 'winner', 'conquestStartTime', 'conquestEndTime', 'requiredVictoryTowns' ];
    return array_intersect_key( $war, array_flip( $keys ) );
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

  /**
   * Get async updates
   * @return [type] [description]
   */
  public function async_dynamics()
  {
    $this->logger->debug( 'Starting async' );
    $maps = $this->get_map_list();
    $promises = array();

    foreach ( $maps as $map )
    {
      $name = $this->map_name( $map );
      $promises[ $name ] = $this->get_async( 'worldconquest/maps/' . $map . '/dynamic/public' );
    }

    $data = array();
    $responses = PromiseUtils::unwrap( $promises );
    foreach ( $responses as $name => $response )
    {
      // cached results are in Array form, non cached need to be decoded first
      $body = is_array( $response ) ? $response : json_decode( $response->getBody(), true );
      // compress item data
      $items = array_map( function( $item )
      {
        return [
          // rounding decimals reduces file size, triggers less updates on the client side and you won't even notice
          'x' => number_format( $item[ 'x' ], $this->coordinate_decimals ) * 1,
          'y' => number_format( $item[ 'y' ], $this->coordinate_decimals ) * 1,
          // just the first team letter will do
          't' => $item[ 'teamId' ] !== 'NONE' ? substr( $item[ 'teamId' ], 0, 1 ) : '',
          'i' => $item[ 'iconType'],
          'f' => $item[ 'flags' ]
        ];
      }, $body[ 'mapItems'] );

      // compress data
      $data[ $name ] = [
        'i' => $body[ 'regionId' ],
        's' => $body[ 'scorchedVictoryTowns' ],
        'l' => $body[ 'lastUpdated' ],
        'v' => $body[ 'version' ],
        'd' => $items
      ];
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
}
