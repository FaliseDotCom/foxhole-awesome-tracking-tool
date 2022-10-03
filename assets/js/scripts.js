
(function() {

  const api_url = '/api.php',
        x_range = 109199.999997,
        y_range = 94499.99999580906968410989;

  let map_data,
      $root,
      $map,
      $hex,
      $pop;

  const docReady = () =>
  {
    $root = document.getElementById( 'fatt-root' );
    $maps = document.getElementById( 'maps' );
    loadMap();
  };

  const loadMap = () =>
  {
    const response = fetch( '/api.php?map' )
      .then( data => data.json() )
      .then( json => {
        map_data = json;
        buildMap()
      }
    );
  };

  const getHexImage = name => '/assets/images/maps/Map' + name + 'Hex.png';

  // build the map
  const buildMap = () =>
  {
    for ( const [ name, data ] of Object.entries( map_data ) )
    {
      const $t = tmplEl( 'tmplMap', data );
      $maps.appendChild( $t );
      $t.addEventListener( 'mouseover', e => $maps.classList.add( 'blur' ) );
      $t.addEventListener( 'mouseleave', e => maps.classList.remove( 'blur' ) );
      $t.addEventListener( 'click', e => {
        showHex( data )
        e.stopPropagation();
      } );
    }
  };

  // create an element from a template and some data
  const tmplEl = ( name, data ) =>
  {
    const t = tmpl( name, data ),
          e = document.createElement( 'div' );
    e.innerHTML = t.trim();
    return e.firstChild;
  };

  const showHex = data =>
  {
    // remove existing
    if ( $pop ) $maps.removeChild( $pop );

    // load from template and add to page
    $pop = tmplEl( 'tmplPop', data );
    $maps.appendChild( $pop );

    // close button
    $pop.querySelector( '.close' ).addEventListener( 'click', e => {
      e.preventDefault();
      closePop();
    });
    // fade in
    setTimeout( () => {
      $root.classList.add( 'has-pop' );
    }, 1 );

    // load details if missing
    if ( !data.mapItems || !data.mapItems.length )
    {
      fetch( '/api.php?details=' + data.hex )
        .then( data => data.json() )
        .then( json => {
          // add details to data object
          data.mapItems = json.mapItems;
          // rebuild popup
          showHex( data );
          // fadein
          setTimeout( () =>
          {
            $pop.classList.add( 'loaded' );
          }, 100 );
        } );
     }
     else
     {
        setTimeout( () =>
        {
          $pop.classList.add( 'loaded' );
        }, 100 );
     }
  };

  const closePop = e => {
    $root.classList.remove( 'has-pop' );
    setTimeout( () => {
      $maps.removeChild( $pop );
      $pop = null;
    }, 600 );
  };

  document.addEventListener( "DOMContentLoaded", docReady );

  document.addEventListener( 'click', e =>
  {
    if ( $pop && !$pop.contains( e.target ) )
    {
      closePop();
    }
  });

})();