<?php

// class for rendering hex grid
class Grid extends FileCache
{

  private $grid = [];
  private $hex_width = 1024;
  private $hex_height = 888;
  private $grid_width_factor = 1.333;
  private $grid_height_factor = 2;
  private $grid_width = 0;
  private $grid_height = 0;
  private $map_width = 0;
  private $map_height = 0;

  function __construct( string $grid_file = '' )
  {
    $this->grid = json_decode( file_get_contents( $grid_file ), true );
    $this->grid_width = $this->hex_width / $this->grid_width_factor;
    $this->grid_height = $this->hex_height / $this->grid_height_factor;
  }

  public function getMapSize()
  {
    if ( !$this->map_width || !$this->map_height )
    {
      foreach ( $this->grid as $name => $coords )
      {
        // get coordinate
        $x = $coords[ 0 ] * $this->grid_width;
        $y = $coords[ 1 ] * $this->grid_height;

        // get max dimensions
        $this->map_width  = max( $this->map_width,  $x + $this->hex_width );
        $this->map_height = max( $this->map_height, $y + $this->hex_height );
      }
    }
    return [ intval( $this->map_width ), intval( $this->map_height ) ];
  }

  /**
   * Render a tile, render with a function with the following params: x, y, width, height, name
   * @param  [type] $renderer [description]
   * @return [type]           [description]
   */
  public function render( $renderer = null )
  {
    if ( !$renderer ) return '';

    ob_start();
    foreach ( $this->grid as $name => $coords )
    {
      $renderer(
        $coords[ 0 ] * $this->grid_width,
        $coords[ 1 ] * $this->grid_height,
        $this->hex_width,
        $this->hex_height,
        $name
      );
    }
    // return clean html
    return $this->clean_output( ob_get_clean() ) ;
  }

  private function clean_output( string $output ) : string
  {
    // remove double spaces and newlines
    return str_replace( [ "\r", "\n", "  " ], '', $output );
  }

  /**
   * Render a tile with a specific HTML tag
   * @param  string        $tag      [description]
   * @param  function|null $renderer [description]
   * @return [type]                  [description]
   */
  public function renderTag( string $tag = 'div', $renderer = null )
  {
    return $this->render( function( $x, $y, $w, $h, $n ) use ( $tag, $renderer )
    {
      echo "<$tag style=\"left: $x; top: $y; width: $w; height: $h;\" class=\"$n\">";
      if ( $renderer ) $renderer( $x, $y, $w, $h, $n );
      echo "</$tag>";
    } );
  }

  /**
   * Render an svg tile
   * @param  string        $tag      [description]
   * @param  function|null $renderer [description]
   * @return [type]                  [description]
   */
  public function renderSvg( $renderer = null )
  {
    return $this->render( function( $x, $y, $w, $h, $n ) use ( $renderer )
    {
      echo "<svg x=\"$x\" y=\"$y\" width=\"$w\" height=\"$h\" class=\"$n\">";
      if ( $renderer ) $renderer( $x, $y, $w, $h, $n );
      echo "</svg>";
    } );
  }
}