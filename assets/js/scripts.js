
(function() {

  const api_url = '/api.php',
        map_aspect = 1000/985,
        drag_min = 10,
        zoom_max = 50,
        zoom_step = .1,
        zoom_width = 1000,
        zoom_click = 4;

  let map_data,
      shard = 'able',
      $root,
      $hex,
      $map,
      $shards,
      $header,
      map_x = 0,
      map_y = 0,
      start_x,
      start_y,
      drag_x,
      drag_y,
      dragging = false,
      zoom = 1,
      zoom_min = .1,
      $zoom_in,
      $zoom_out,
      $zoom_level;

  // document ready
  const docReady = () =>
  {
    // get elements
    $root = document.getElementById( 'fatt-root' );
    $map = $root.querySelector( 'div#map' );
    $header = $root.querySelector( '.header' );
    $shards = $header.querySelectorAll( '.shard-picker .shards label' );
    $zoom_in = $header.querySelector( '.zoom-in' );
    $zoom_out = $header.querySelector( '.zoom-out' );
    $zoom_level = $header.querySelector( '.zoom-level' );

    // begin stuff
    initShards();
    initZoom();
    initMap();
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
    // calculate zoom factors
    const zoom_in =  1 + zoom_step,
          zoom_out = 1 - zoom_step;

    // zoom in / out
    $zoom_in.addEventListener( 'click', () => zoomMap( zoom * zoom_in ) );
    $zoom_out.addEventListener( 'click', () => zoomMap( zoom * zoom_out ) );
  };

  // init map resize
  const initMap = () =>
  {
    // fit map in screen and center it
    fitMap();
    centerMap();

    // listen to window resize and do an initial resize
    window.addEventListener( 'resize', resizeMap );
    setTimeout( resizeMap, 100 );

    // add drag events
    $map.addEventListener( 'mousedown', startDrag );
    $map.addEventListener( 'touchstart', startDrag );

    // get all hexes in the map
    $hex = $map.querySelectorAll( '.hex' );
  };

  // fit map in screen
  const fitMap = () =>
  {
    // fit in screen
    const ww = window.innerWidth,
          hh = $header.offsetHeight,
          wh = window.innerHeight - hh,
          m = 10,
          wa = ww / wh,
          mz = ( wa > map_aspect )
                ? ( wh - 10 ) * map_aspect
                : ( ww - m  );

    zoomMap( mz / zoom_width );
    zoom_min = zoom;
  };

  // center map on screen
  const centerMap = () =>
  {
    // center
    const ww = window.innerWidth,
          hh = $header.offsetHeight,
          wh = window.innerHeight - hh,
          mw = $map.offsetWidth,
          mh = $map.offsetHeight;

    panMap( ( ww - mw ) / 2, ( wh - mh ) / 2 + hh );
  }

  // resize the map
  const resizeMap = () =>
  {
    const w = $map.offsetWidth;
    $map.style.height = w / map_aspect + 'px';
    $map.style.setProperty( '--map-width', w + 'px');

    // set labels based on min width
    w < 3000
      ? $map.classList.add( 'small' )
      : $map.classList.remove( 'small' );
  };

  // get hex in centre
  const getCenterHex = () =>
  {

  };

  // start map drag
  const startDrag = e =>
  {
    if ( !dragging )
    {
      // get coordinates
      const ec = getEventCoords( e ),
            mc = mapCoords();
      // set start coordinates
      start_x = ec.x;
      start_y = ec.y;
      // set inital map coordinates
      map_x = mc.x
      map_y = mc.y
      // add events
      document.addEventListener( 'mouseup', stopDrag );
      document.addEventListener( 'touchend', stopDrag );
      document.addEventListener( 'mousemove', doDrag );
      document.addEventListener( 'touchmove', doDrag );
      // break off any animation
      $map.style.transition = 'none';
    }

    // prevent default stuff like picking up an image
    e.preventDefault();
  }

  // stop map drag
  const stopDrag = e =>
  {
    // remove drag events
    document.removeEventListener( 'mouseup', stopDrag );
    document.removeEventListener( 'touchend', stopDrag );
    document.removeEventListener( 'mousemove', doDrag );
    document.removeEventListener( 'touchmove', doDrag );

    // disable dragging with a short delay, otherwise it might be considered a hex click
    setTimeout( () =>
    {
      dragging = false;
    }, 10 );
  }

  // handle map dragging
  const doDrag = e =>
  {
    // get new coordinates
    const coords = getEventCoords( e );
    drag_x = coords.x;
    drag_y = coords.y;

    const diff_x = drag_x - start_x,
          diff_y = drag_y - start_y;

    // set dragging based on minimum drag distance
    if ( !dragging )
    {
      dragging = Math.abs( diff_x ) > drag_min || Math.abs( diff_y ) > drag_min;
    }

    // move map
    if ( dragging )
    {
      panMap( map_x + diff_x, map_y + diff_y );
    }

    // prevent default stuff
    e.preventDefault();
  }

  // get coordinates from an event
  const getEventCoords = e =>
  {
    e = e || window.event;
    x = e.clientX;
    y = e.clientY;
    if ( e.type.indexOf( 'touch') === 0 )
    {
        var touch = e.touches[0];
        x = touch.clientX;
        y = touch.clientY;
    }
    return { x: x, y: y };
  }

  // set map zoom
  const zoomMap = ( z = 1, nopan = false ) =>
  {
    // apply zoom bounds
    zoom = Math.min( zoom_max, Math.max( zoom_min, z || 1 ) );

    // get original width and position and new size
    const ow = parseFloat( $map.style.width ),
          oh = parseFloat( $map.style.height ),
          oc = mapCoords(),
          w = zoom * zoom_width,
          h = w / map_aspect;

    // set zoom level display
    $zoom_level.innerHTML = zoom < 10 ? String( zoom ).substring( 0, 3 ) : Math.round( zoom );

    // set width in pixels
    $map.style.width = w + 'px';
    // pan to counter zoom
    if ( !nopan )
    {
      panMap( oc.x - ( w - ow ) / 2, oc.y - ( h - oh ) / 2 );
    }
    // resize the map
    resizeMap();
  }

  // get map coordinates
  const mapCoords = () =>
  {
    const x = parseFloat( $map.style.left || 0 ),
          y = parseFloat( $map.style.top || 0 );
    return { x: x, y: y };
  }

  // set map pan
  const panMap = ( x = 0, y = 0 ) =>
  {
    $map.style.left = x + 'px';
    $map.style.top = y + 'px';
  }

  // load map details from API
  const loadMap = () =>
  {
    const response = fetch( '/api.php?map&shard=' + shard )
      .then( data => data.json() )
      .then( json => {
        map_data = json;
        buildMap()
      }
    );
  };

  // set map animation mode
  const animateMap = ( size = false, pos = false, time = 500 ) =>
  {
    let transition = [];
    if ( ( size || pos ) && time > 0 )
    {
      // set duration string
      const duration = time + 'ms';
      // add size and pos
      if ( size )
      {
        transition.push( 'width ' + duration );
        transition.push( 'height ' + duration );
      }
      if ( pos )
      {
        transition.push( 'left ' + duration );
        transition.push( 'top ' + duration );
      }
      // remove when done
      setTimeout( () => {
        $map.style.transition = 'none';
      }, time );
    }
    else
    {
      transition = 'none';
    }
    $map.style.transition = transition.join(', ');
  };

  // build the map
  const buildMap = () =>
  {
    // clear map
    $map.innerHTML = '';

    // replace with loaded data
    for ( const [ name, data ] of Object.entries( map_data ) )
    {
      // render template and add to map
      const $t = tmplEl( 'tmplMap', data );
      $map.appendChild( $t );
      // add blur events
      $t.addEventListener( 'mouseover',  e => $map.classList.add( 'blur' ) );
      $t.addEventListener( 'mouseleave', e => $map.classList.remove( 'blur' ) );
      // click event
      $t.addEventListener( 'click', e =>
      {
        if ( !dragging )
        {
          // fill with data
          loadHex( data );

          // start animation
          // animateMap( true, true );

          // zoom into detail level if needed
          if ( zoom < zoom_click )
          {
            zoomMap( zoom_click, true );
          }

          // get map coordinates
          const oc = mapCoords();

          // get stuff for calc
          const rect = $t.getBoundingClientRect(),
                ww = window.innerWidth,
                hh = $header.offsetHeight,
                wh = window.innerHeight - hh,
                x = rect.x + rect.width / 2,
                y = rect.y + rect.height / 2;

          // pan to center on hex location
          panMap( oc.x + ( ww / 2 - x ) , oc.y + ( wh / 2 - y ) + hh );



          // stop click throughs
          e.stopPropagation();
        }
      } );
    }
    // get hexes inside the map
    $hex = $map.querySelectorAll( '.hex' );
    // reset the map for good measure
    resizeMap();
  };

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