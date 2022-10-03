<?php

// extend Inouet cache class and extend on it
class Cache extends FileCache
{
  private $__dir = '';

  function __construct( string $dir = '' )
  {
    $this->__dir = CACHE_DIR . $dir;
    return parent::__construct( [ 'cache_dir' => $this->__dir ] );
  }

  /**
   * Clear a directory of all files and directories
   * @param  string       $dir         [description]
   * @param  bool|boolean $remove_self [description]
   * @return [type]                    [description]
   */
  private static function clear_dir(  string $dir = '', bool $remove_self = false )
  {
    // dir must exist, be a dir and be inside the cache dir
    if ( empty( $dir ) ) return;
    if ( !defined( 'CACHE_DIR' ) ) return;
    if ( strpos( $dir, CACHE_DIR ) !== 0 ) return;
    if ( !is_dir( $dir ) ) return;

    $objects = scandir( $dir );
    foreach ( $objects as $object )
    {
      if ( $object != "." && $object != ".." )
      {
        $path = $dir . "/" . $object;
        if ( is_dir( $path) )
        {
          self::clear_dir( $path, true );
          if ( $remove_self ) rmdir( $path );
        }
        else
        {
           unlink( $path );
        }
      }
    }
  }

  /**
   * Clear all caches
   * @return [type] [description]
   */
  public static function clear_all()
  {
    self::clear_dir( defined( 'CACHE_DIR' ) ? CACHE_DIR : '' );
  }

  /**
   * Clear cache in a directory
   * @param  string $dir [description]
   * @return [type]      [description]
   */
  public function clear( string $dir = '' )
  {
    // use root cache dir if no dir was specified
    self::clear_dir( $dir ?: $this->__dir );
  }
}