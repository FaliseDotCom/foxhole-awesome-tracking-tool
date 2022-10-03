<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>F.A.T.T. - a Foxhole Artillery Targeting Tool</title>
    <link rel="stylesheet" href="/assets/css/style.css">
    <link rel="stylesheet" href="/assets/css/icons.css.php">
  </head>
  <body>
    <div id="fatt-root">
      <div class="header">
        <h1>F.A.T.T.</h1>
        <h2>Foxhole Artillery Targeting Tool</h2>
      </div>
      <div id="fatt-map">
        <div id="maps"></div>
      </div>
    </div>

    <?php // add JS ?>
    <script src="/assets/js/tmpl.js"></script>
    <script src="/assets/js/scripts.js"></script>

    <?php
      // add JS templates
      require( 'templates/map.php' );
      require( 'templates/pop.php' );
    ?>

  </body>
</html>