<!DOCTYPE html>
<?php

  require_once( 'inc.php' );

  $api = new FoxholeApi();
  $maps = $api->get_map_list();
  $shards = $api->get_shards();

  // load hex grid
  $grid = json_decode( file_get_contents( 'hex-grid.json' ), true );
  $hex_width = 1024;
  $hex_height = 888;
  $grid_width = $hex_width / 1.333;
  $grid_height = $hex_height / 2;

?>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>F.A.T.T. - a Foxhole Artillery Targeting Tool</title>
    <link rel="stylesheet" href="/assets/css/style.css">
    <link rel="stylesheet" href="/assets/css/map-grid.css">
    <link rel="stylesheet" href="/assets/css/map-hex.css">
    <link rel="stylesheet" href="/assets/css/map-item.css">
    <link rel="stylesheet" href="/assets/css/icons.css.php">
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
        <?php if ( !isset( $_GET[ 'svg' ] ) ) { ?>
          <div id="map">
            <?php
              foreach ( $maps as $map )
              {
                $name = $api->map_name( $map );
                $title = $api->map_title( $map );
                ?>
                  <div id="<?php echo $name; ?>" class="hex">
                    <h4 class="title"><?php echo $title; ?></h4>
                    <img class="map" src="/assets/images/maps/Map<?php echo $name; ?>Hex.png" alt="<?php echo $title; ?>"/>
                  </div>
                <?php
              }
            ?>
          </div>
        <?php } else { ?>
          <svg id="map" width="6144" height="6216" viewbox=" 0 0 6144 6216" preserveAspectRatio="xMinYMid meet" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
             <?php
              foreach ( $grid as $name => $coords )
              {
                $title = $api->map_title( $name );
                ?>
                <svg
                  height="<?php echo $hex_height; ?>px"
                  width="<?php echo $hex_width; ?>px"
                  x="<?php echo $coords[ 0 ] * $grid_width; ?>px"
                  y="<?php echo $coords[ 1 ] * $grid_height; ?>px"
                  class="hex"
                  id="<?php echo $name; ?>"
                >
                  <image href="/assets/images/maps/Map<?php echo $name; ?>Hex.png" height="100%" width="100%" class="hex-bg" />
                  <text x="50%"  y="50%"  dominant-baseline="middle" text-anchor="middle" class="hex-title" >
                    <?php echo $title; ?>
                  </text>
                </svg>
                  <?php
              }
            ?>
          </svg>
        <?php } ?>
      </div>
    </div>

    <?php // add JS ?>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
    <script src="/assets/js/tmpl.js"></script>
    <script src="/assets/js/scripts.js"></script>

    <?php
      // add JS templates
      require( 'templates/map.php' );
    ?>

  </body>
</html>