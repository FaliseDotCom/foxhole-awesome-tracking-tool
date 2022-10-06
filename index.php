<!DOCTYPE html>
<?php

  require_once( 'inc.php' );
  require_once( 'lib/grid.php' );
  require_once( 'lib/icons.php' );

  $api = new FoxholeApi();
  $map = $api->get_static_world( true );
  $shards = $api->get_shards();
  $grid = new Grid( 'hex-grid.json' );

  // background tiles
  $backgrounds = $grid->renderSvg( function( $x, $y, $w, $h, $n ) use ( $api )
  {
    ?>
      <image href="/assets/images/maps/Map<?php echo $n; ?>Hex.png" height="100%" width="100%"></image>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
        <?php echo $api->map_title( $n ); ?>
      </text>
    <?php
  } );

  // border tiles
  $borders = $grid->renderSvg( function( $x, $y, $w, $h, $n )
  {
    ?><polygon points="255,0 770,0 1024,444 770,888 255,888 0,444"></polygon><?php
  } );

  // static tyles
  $statics = $grid->renderSvg( function( $x, $y, $w, $h, $n ) use ( $map )
  {
    $items = isset( $map[ $n ] ) ? $map[ $n ] : array();
    foreach ( $items as $item )
    {
      ?><text x="<?php echo $item[ 'x' ] * $w; ?>" y="<?php echo $item[ 'y' ] * $h; ?>" dominant-baseline="middle" text-anchor="middle"><?php echo $item[ 'text' ]; ?></text><?php
    }
  } );

  // blank tiles
  $hexes = $grid->renderSvg();

  // get map dimensions
  $map_size = $grid->getMapSize();

?>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>F.A.T.T. - a Foxhole Artillery Targeting Tool</title>
    <link rel="stylesheet" href="/assets/css/style.css">
    <link rel="stylesheet" href="/assets/css/map-item.css">
    <script>
      <?php // list of icons for the dynamic layer ?>
      var dynamic_icons = <?php echo json_encode( Icons::getIcons() ); ?>;
    </script>
  </head>
  <body>
    <div id="fatt-root">

      <div class="header">

        <div class="logo">
          <h1>F.A.T.T.</h1>
          <h2>Foxhole Artillery Targeting Tool</h2>
        </div>

        <div class="shard-picker block">
          <div class="legend">Pick a shard, any shard:</div>
          <div class="inner shards">
            <?php
              foreach ( $shards as $shard )
              {
                ?>
                <label>
                  <input type="radio" name="shard" value="<?php echo $shard; ?>"/>
                  <div><?php echo $shard; ?></div>
                </label>
                <?php
              }
            ?>
          </div>
        </div>

        <div class="map-zoom block">
          <div class="legend">Map zoom:</div>
          <div class="inner">
            <button class="zoom-out">-</button>
            <div class="zoom-level">88</div>
            <button class="zoom-in">+</button>
          </div>
        </div>
      </div>

      <div id="fatt-map">
        <svg id="map" width="<?php echo $map_size[ 0 ]; ?>" height="<?php echo $map_size[ 1 ]; ?>" viewbox=" 0 0 <?php echo join( ' ', $map_size ); ?>" preserveAspectRatio="xMinYMid meet" xmlns="http://www.w3.org/2000/svg">
          <svg id="backgrounds"><?php echo $backgrounds; ?></svg>
          <svg id="borders"><?php echo $borders; ?></svg>
          <svg id="dynamics"><?php echo $hexes; ?></svg>
          <svg id="statics"><?php echo $statics; ?></svg>
        </svg>
      </div>
    </div>

    <?php // add JS ?>
    <script src='https://unpkg.com/panzoom@9.4.0/dist/panzoom.min.js'></script>
    <script src="/assets/js/tmpl.js"></script>
    <script src="/assets/js/scripts.js"></script>

    <?php
      // add JS templates
      require( 'templates/dynamic.php' )
    ?>

  </body>
</html>