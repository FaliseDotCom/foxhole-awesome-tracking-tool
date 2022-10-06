
(function() {

  const api_url = '/api.php',
        zoom_min = .08,
        zoom_max = 7,
        zoom_step = .5,
        zoom_click = 1;

  let dynamic_data,
      shard = 'able',
      $root,
      $hex,
      $map,
      $shards,
      $header,
      $zoom_in,
      $zoom_out,
      $zoom_level,
      map_control,
      // svg layers
      $backgrounds,
      $borders,
      $statics,
      $dynamics;

  // document ready
  const docReady = () =>
  {
    // get elements
    $root = document.getElementById( 'fatt-root' );
    $map = $root.querySelector( '#map' );
    $header = $root.querySelector( '.header' );
    $shards = $header.querySelectorAll( '.shard-picker .shards label' );
    $zoom_in = $header.querySelector( '.zoom-in' );
    $zoom_out = $header.querySelector( '.zoom-out' );
    $zoom_level = $header.querySelector( '.zoom-level' );
    $backgrounds = $map.querySelector( '#backgrounds' );
    $borders = $map.querySelector( '#borders' );
    $statics = $map.querySelector( '#statics' );
    $dynamics = $map.querySelector( '#dynamics' );

    // begin stuff
    initShards();
    initMap();
    initZoom();
    loadMap();
  };

  // init shard selector
  const initShards = () =>
  {
    $shards.forEach( $shard =>
    {
      $shard.addEventListener( 'click', e =>
      {
        // get value
        const value = $shard.querySelector( 'input' ).value;
        // make sure if differs
        if ( value !== shard )
        {
          // set shard
          shard = value;
          // reload the map
          loadMap();
        }
      });
    });

    // check the first one
    $shards[ 0 ].querySelector( 'input' ).checked = true;
  };

  // init zoom buttomns
  const initZoom = () =>
  {
    // zoom in / out
    $zoom_in.addEventListener( 'click', () => zoomMapBy( 1 + zoom_step, true ) );
    $zoom_out.addEventListener( 'click', () => zoomMapBy( 1 - zoom_step, true ) );

    // update zoom after a touch
    document.addEventListener( 'touchend', updateZoom );
  };

  // init map resize
  const initMap = () =>
  {
    map_control = panzoom( $map, {
      minZoom: zoom_min,
      maxZoom: zoom_max
    });

    // fit map in screen and center it
    fitMap();
  };

  // get zoom level
  const getZoom = () => map_control.getTransform().scale;

  // update zoom interface level
  const updateZoom = () =>
  {
    const zoom = getZoom();
    $zoom_level.innerHTML = zoom > 10 ? Math.round( zoom ) : String( zoom ).substring( 0, 3 );
  }

  // fit map in screen, do this ONCE
  const fitMap = () =>
  {
    // fit in screen
    const ww = window.innerWidth,
          hh = $header.offsetHeight,
          wh = window.innerHeight - hh,
          mr = $map.getBoundingClientRect(),
          ma = mr.width / mr.height,
          wa = ww / wh,
          zw = ( wa > ma ) ? wh * ma : ww,
          zf = ( wa > ma ) ? .9 * zw / mr.width : zw / mr.width;

    zoomMapTo( zf );

    // get bounds again and center map
    const r = getMapBounds();
    panMapTo( ww / 2 - r.width / 2, $header.offsetHeight );
  };

  const getMapBounds = () =>
  {
    const r = $map.getBoundingClientRect(),
          s = map_control.getTransform().scale,
          width = r.width * s,
          height = r.height * s,
          x = r.x,
          y = r.y;

    return { x, y, width, height };
  };

  // get hex in centre
  const getCenterHex = () =>
  {

  };

  // set map zoom
  const zoomMapBy = ( z = 1, smooth = false,) =>
  {
    // get rect so we can apply center
    const r = $map.getBoundingClientRect(),
          x = r.x + r.width / 2,
          y = r.y + r.height / 2;

    // zoom to desired level
    smooth
      ? map_control.smoothZoom( x, y, z )
      : map_control.zoomTo( x, y, z );

    updateZoom();
  }

  // set map zoom
  const zoomMapTo = ( z = 1, smooth = false,) =>
  {
    // get rect so we can apply center
    const r = getMapBounds();

    // zoom to desired level
    smooth
      ? map_control.smoothZoomAbs( r.width / 2, r.height / 2, z )
      : map_control.zoomAbs( r.width / 2, r.height / 2, z );

    updateZoom();
  }

  // pan map by
  const panMapBy = ( x = 0, y = 0, smooth = false ) =>
  {
    map_control.moveBy( x, y, smooth );
  }

  // pan map to
  const panMapTo = ( x = 0, y = 0, smooth = false ) =>
  {
    smooth
      ? map_control.smoothMoveTo( x, y )
      : map_control.moveTo( x, y);
  };


  // load dynamic world details from API
  const loadMap = () =>
  {
    const response = fetch( '/api.php?dynamic&shard=' + shard )
      .then( data => data.json() )
      .then( json => buildMap( json ) )
    ;
  };

  // (re)build the entire map
  const buildMap = ( data ) =>
  {
    // store for later reference
    dynamic_data = data;

    // replace loaded data
    for ( const [ name, items ] of Object.entries( data ) )
    {
      const $new = tmplEl( 'tmplDynamic', { name, items, getIcon: getIcon } ),
            $old = $dynamics.querySelector( 'svg.' + name );
      if ( $new && $old ) $old.innerHTML = $new.innerHTML;
    }
  };

  const getIcon = ( id ) => dynamic_icons[ id ];

  // load hex data
  const loadHex = data =>
  {
    // load details if missing
    if ( !data.mapItems || !data.mapItems.length )
    {
      fetch( '/api.php?details=' + data.hex + '&shard=' + shard )
        .then( data => data.json() )
        .then( json => {
          // add details to data object
          data.mapItems = json.mapItems;
          // rebuild hex
          fillHex( data );
        } );
     }
  }

  // fill hex with data
  const fillHex = data =>
  {
    const $t = tmplEl( 'tmplMap', data ),
          $hex = document.getElementById( data.name );

    // use inner html
    $hex.innerHTML = $t.innerHTML;

    // fade in
    setTimeout( () =>
    {
      $hex.classList.add( 'loaded' );
    }, 10 );
  }

  document.addEventListener( "DOMContentLoaded", docReady );

})();