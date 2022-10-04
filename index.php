<!DOCTYPE html>
<?php

  require_once( 'inc.php' );

  $api = new FoxholeApi();
  $maps = $api->get_map_list();
  $shards = $api->get_shards();
?>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>F.A.T.T. - a Foxhole Artillery Targeting Tool</title>
    <link rel="stylesheet" href="/assets/css/style.css">
    <link rel="stylesheet" href="/assets/css/map-grid.css">
    <link rel="stylesheet" href="/assets/css/map-items.css">
    <link rel="stylesheet" href="/assets/css/hex-pop.css">
    <link rel="stylesheet" href="/assets/css/icons.css.php">
  </head>
  <body>
    <div id="fatt-root">

      <div class="header">

        <div class="logo">
          <h1>F.A.T.T.</h1>
          <h2>Foxhole Artillery Targeting Tool</h2>
        </div>

        <div class="shard-picker">
          <div class="legend">Pick a shard, any shard:</div>
          <div class="shards">
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
      </div>

      <div id="fatt-map">
        <div id="maps">
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