
(function() {

  const api_url = '/api.php',
        map_aspect = 1000/985,
        drag_min = 10,
        zoom_min = .1,
        zoom_max = 10,
        zoom_click = 4;

  let map_data,
      shard = 'able',
      $root,
      $maps,
      $shards,
      map_x = 0,
      map_y = 0,
      start_x,
      start_y,
      drag_x,
      drag_y,
      dragging = false;

  // document ready
  const docReady = () =>
  {
    $root = document.getElementById( 'fatt-root' );
    $maps = document.getElementById( 'maps' );
    $shards = document.querySelectorAll( '.shard-picker .shards label' );

    initShards();
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
  }

  // init map resize
  const initMap = () =>
  {
    window.addEventListener( 'resize', resizeMap );
    setTimeout( resizeMap, 100 );
    $maps.addEventListener( 'mousedown', startDrag );
    $maps.addEventListener( 'touchstart', startDrag );
  }

  const resizeMap = () =>
  {
    $maps.style.height = $maps.offsetWidth / map_aspect + 'px';
  }

  // start map drag
  const startDrag = e =>
  {
    if ( !dragging )
    {
      // set start coordinates
      const coords = getEventCoords( e );
      start_x = coords.x;
      start_y = coords.y;
      // set inital map coordinates
      map_x = parseInt( $maps.style.left || 0 );
      map_y = parseInt( $maps.style.top || 0 );
      // add events
      document.addEventListener( 'mouseup', stopDrag );
      document.addEventListener( 'touchend', stopDrag );
      document.addEventListener( 'mousemove', doDrag );
      document.addEventListener( 'touchmove', doDrag );
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
  const zoomMap = z =>
  {
    z = Math.max( zoom_min, z );
    z = Math.min( zoom_max, z );
    $maps.style.width = z * 100 + '%';
    resizeMap();
  }

  // set map pan
  const panMap = ( x = 0, y = 0 ) =>
  {
    $maps.style.left = x + 'px';
    $maps.style.top = y + 'px';
  }

  // animate map map
  const animateMap = ( from_x = 0, from_y = 0, to_x = 0, to_y = 0 ) =>
  {
    const dx = from_x - to_x,
          dy = from_y - to_y,
          s = 1000, // pixels per second
          d = Math.sqrt( dx * dx + dy * dy ),
          t = parseInt( d/s * 1000 ); // time it takes to animate in ms

    // reset transition
    $maps.style.transition = '';
    // move to starting position
    panMap( from_x, from_y );
    // set transition
    $maps.style.transition = 'left ' + t + 'ms, top ' + t + 'ms';
    // move to end position
    panMap( to_x, to_y );
    // reset transition
    setTimeout( () =>
    {
      $maps.style.transition = '';
    }, t );
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

  // get hex image from name
  const getHexImage = name => '/assets/images/maps/Map' + name + 'Hex.png';

  // build the map
  const buildMap = () =>
  {
    // clear map
    $maps.innerHTML = '';

    // replace with loaded data
    for ( const [ name, data ] of Object.entries( map_data ) )
    {
      // render template and add to map
      const $t = tmplEl( 'tmplMap', data );
      $maps.appendChild( $t );
      // add blur events
      $t.addEventListener( 'mouseover',  e => $maps.classList.add( 'blur' ) );
      $t.addEventListener( 'mouseleave', e => $maps.classList.remove( 'blur' ) );
      // click event
      $t.addEventListener( 'click', e =>
      {
        if ( !dragging )
        {
          // zoom into detail level first
          zoomMap( zoom_click );

          // get original location
          const o_x = parseInt( $maps.style.left || 0 ),
                o_y = parseInt( $maps.style.top || 0 );

          // reset map position
          panMap( 0, 0 );

          // get stuff for calc
          const rect = $t.getBoundingClientRect(),
                w = window.innerWidth,
                h = window.innerHeight,
                x = rect.x + rect.width / 2,
                y = rect.y + rect.height / 2;

          // pan to center on hex location
          animateMap( o_x, o_y, w / 2 - x , h / 2 - y );

          // fill with data
          loadHex( data );

          // stop click thru
          e.stopPropagation();
        }
      } );
    }
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