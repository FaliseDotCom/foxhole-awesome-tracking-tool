
(function() {

  const api_url = '/api.php',
        zoom_min = .08,
        zoom_max = 7,
        zoom_step = .5,
        zoom_click = 1,
        pan_step = 100;

  let dynamic_data,
      shard = 'able',
      $root,
      $hex,
      $map,
      $shards,
      $header,
      $zoom_in,
      $zoom_out,
      map_control,
      // svg layers
      $backgrounds,
      $borders,
      $statics,
      $dynamics,
      $deadcenter;

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
    $backgrounds = $map.querySelector( '#backgrounds' );
    $borders = $map.querySelector( '#borders' );
    $statics = $map.querySelector( '#statics' );
    $dynamics = $map.querySelector( '#dynamics' );
    $deadcenter = $backgrounds.querySelector( '.DeadLands' );

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
    $zoom_in.addEventListener( 'click', zoomMapIn );
    $zoom_out.addEventListener( 'click', zoomMapOut );

    document.addEventListener( 'keyup', e =>
    {
      switch ( e.code )
      {
        case 'Equal':
        case 'NumpadAdd':
          return zoomMapIn( e );
        case 'Minus':
        case 'NumpadSubtract':
          return zoomMapOut( e );
        case 'ArrowLeft':
        case 'Numpad4':
        case 'KeyA':
          return panMapRight( e );
        case 'ArrowRight':
        case 'Numpad6':
        case 'KeyD':
          return panMapLeft( e );
        case 'ArrowUp':
        case 'Numpad8':
        case 'KeyW':
          return panMapDown( e );
        case 'ArrowDown':
        case 'Numpad2':
        case 'KeyS':
          return panMapUp( e );
        case 'Numpad7':
          return panMapDownRight( e );
        case 'Numpad9':
          return panMapDownLeft( e );
        case 'Numpad1':
          return panMapUpRight( e );
        case 'Numpad3':
          return panMapUpLeft( e );
        case 'Numpad5':
          // return panMapCenter( e );
      }
    });
  };

  // this one is buggy!
  const panMapCenter = e =>
  {
    // const c = getMapBounds();
    // panMapTo( c.x + c.width / 2, c.y + c.height / 2, true );
    return cancelEvent( e );
  };

  const panMapUpLeft = e =>
  {
    panMapBy( -pan_step, -pan_step, true );
    return cancelEvent( e );
  };

  const panMapUpRight = e =>
  {
    panMapBy( pan_step, -pan_step, true );
    return cancelEvent( e );
  };

  const panMapDownLeft = e =>
  {
    panMapBy( -pan_step, pan_step, true );
    return cancelEvent( e );
  };

  const panMapDownRight = e =>
  {
    panMapBy( pan_step, pan_step, true );
    return cancelEvent( e );
  };

  const panMapLeft = e =>
  {
    panMapBy( -pan_step, 0, true );
    return cancelEvent( e );
  };

  const panMapRight = e =>
  {
    panMapBy( pan_step, 0, true );
    return cancelEvent( e );
  };

  const panMapUp = e =>
  {
    panMapBy( 0, -pan_step, true );
    return cancelEvent( e );
  };

  const panMapDown = e =>
  {
    panMapBy( 0, pan_step, true );
    return cancelEvent( e );
  };

  const zoomMapIn = e =>
  {
    zoomMapBy( 1 + zoom_step, true );
    return cancelEvent( e );
  };

  const zoomMapOut = e =>
  {
    zoomMapBy( 1 - zoom_step, true );
    return cancelEvent( e );
  };

  const cancelEvent = e =>
  {
    if ( e )
    {
      e.preventDefault();
      e.stopPropagation();
    }
    return false;
  }

  // init map resize
  const initMap = () =>
  {
    map_control = panzoom( $map, {
      minZoom: zoom_min,
      maxZoom: zoom_max,
      // transformOrigin: { x: 0.5, y: 0.5 },
      // don't let panzoom handle key events
      filterKey: () => true
    });

    // fit map in screen and center it
    fitMap();
  };

  // get zoom level
  const getZoom = () => map_control.getTransform().scale;

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
    if ( isNaN( z ) ) return;

    // get rect so we can apply center
    const r = $map.getBoundingClientRect(),
          x = r.x + r.width / 2,
          y = r.y + r.height / 2;

    // zoom to desired level
    smooth
      ? map_control.smoothZoom( x, y, z )
      : map_control.zoomTo( x, y, z );
  }

  // set map zoom
  const zoomMapTo = ( z = 1, smooth = false,) =>
  {
    if ( isNaN( z ) ) return;
    // get rect so we can apply center
    const r = getMapBounds();

    // zoom to desired level
    smooth
      ? map_control.smoothZoomAbs( r.width / 2, r.height / 2, z )
      : map_control.zoomAbs( r.width / 2, r.height / 2, z );
  }

  // pan map by
  const panMapBy = ( x = 0, y = 0, smooth = false ) =>
  {
    if ( isNaN( x ) || isNaN( y ) ) return;
    map_control.moveBy( x, y, smooth );
  }

  // pan map to
  const panMapTo = ( x = 0, y = 0, smooth = false ) =>
  {
    if ( isNaN( x ) || isNaN( y ) ) return;
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
      buildlHex( name, items );
    }
  };

  // get icon path by id
  const getIcon = ( id ) => dynamic_icons[ id ];

  // load data for a single hex
  const loadHex = name =>
  {
    fetch( '/api.php?details=' + name + '&shard=' + shard )
      .then( data => data.json() )
      .then( json => buildHex( name, json ) )
    ;
  }

  // update a single hex on the map
  const buildlHex = ( name, items ) =>
  {
    const $new = tmplEl( 'tmplDynamic', { name, items, getIcon: getIcon } ),
          $old = $dynamics.querySelector( 'svg.' + name );
    if ( $new && $old ) $old.innerHTML = $new.innerHTML;
  }

  document.addEventListener( "DOMContentLoaded", docReady );

})();