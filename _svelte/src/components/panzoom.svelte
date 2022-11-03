 <script>
  
  import { onMount } from 'svelte';
  import panzoom from 'panzoom';
  import { zoom } from '@stores/zoom'
  import { visible } from '@stores/visible';
  import { config } from '@stores/config';
  import { debounce } from '@lib/debounce';

  export let  args = {
                minZoom: zoom.min,
                maxZoom: zoom.max,
                smoothScroll: false,
                // bounds: true                
              },
              zoom_step = zoom.step,
              pan_step = 100;

  let root = null,
      pz = null,
      save = true,
      scale = 0;

  const log = config.log.zoom;

  // only block touch events on the panzoom itself, not when clicking on other elements
  const onTouch = e => root ? root.contains( e.target ) : false;

  onMount( () =>
  {
    pz = panzoom( root, {
      ...args,      
      onTouch,
      // we use our own keyboard events so block the defaults
      filterKey: () => true,
    } );
    
    onResize();
    
    // add a short delay
    setTimeout( () =>
    {
      loadTransform();

      // update transform stuff here and there     
      pz.on( 'transform', debounce( onPanzoomUpdate, 200 ) );

      // run once on startup
      onPanzoomUpdate();
    }, 10 )
  } );

  // pan / zoom update event
  const onPanzoomUpdate = () =>
  {
    // store zoom 
    const t = pz.getTransform();
    zoom.set( t.scale );

    // update visible rows / cols
    visible.setVisible( t );

    // store current transform
    setTimeout( saveTransform, 100 );    
  }

  // save transform (x, y, scale) in localstorage
  const saveTransform = () =>
  {
    if ( window && window.localStorage )
    {
      const t = pz.getTransform();
      window.localStorage.setItem( 'pzt', JSON.stringify( t ) );
    }
  }

  // retrieve transform (x, y, scale) from localstorage and apply it
  const loadTransform = () =>
  {
    let done = false;
    if ( window && window.localStorage )
    {
      try
      {
        const data = window.localStorage.getItem( 'pzt' );
        if ( false && data )
        {
          const t = JSON.parse( data )
          if ( t )
          {
            pz.zoomAbs( 0, 0, t.scale );
            pz.moveTo( t.x, t.y );
            done = true;
          }
        }
      }
      catch( e ) { console.error( 'loadTransform failed', e ) }

      // at least center the map on screen
      if ( !done ) panCenter();
    }
  }

  const onResize = () =>
  {
    if ( !root || !pz ) return;
  }

  // listen to keyboard events for pan & zoom
  const onKeyUp = e =>
  {
    if ( !root || !pz ) return;
    switch ( e.code )
    {
      case 'Equal':
      case 'NumpadAdd':
        return zoomIn( e );
      case 'Minus':
      case 'NumpadSubtract':
        return zoomOut( e );
      case 'ArrowLeft':
      case 'Numpad4':
      case 'KeyA':
        return panRight( e );
      case 'ArrowRight':
      case 'Numpad6':
      case 'KeyD':
        return panLeft( e );
      case 'ArrowUp':
      case 'Numpad8':
      case 'KeyW':
        return panDown( e );
      case 'ArrowDown':
      case 'Numpad2':
      case 'KeyS':
        return panUp( e );
      case 'Numpad7':
        return panDownRight( e );
      case 'Numpad9':
        return panDownLeft( e );
      case 'Numpad1':
        return panUpRight( e );
      case 'Numpad3':
        return panUpLeft( e );
      case 'Numpad5':
        return panCenter( e );
    }
  }

  // this one is buggy!
  const panCenter = e =>
  {
    if ( !root ) return;
    const r = root.getBoundingClientRect(),
          p = pz.getTransform(),
          w = window.innerWidth,
          h = window.innerHeight,
          left = 0,
          top = 0,
          x = -( r.left + r.width / 2) * p.scale + w / 2 + left,
          y = -( r.top + r.height / 2) * p.scale + h / 2 + top;

    panTo( x, y,  true );
    return cancelEvent( e );
  };

  const panUpLeft = e =>
  {
    panBy( -pan_step, -pan_step, true );
    return cancelEvent( e );
  };

  const panUpRight = e =>
  {
    panBy( pan_step, -pan_step, true );
    return cancelEvent( e );
  };

  const panDownLeft = e =>
  {
    panBy( -pan_step, pan_step, true );
    return cancelEvent( e );
  };

  const panDownRight = e =>
  {
    panBy( pan_step, pan_step, true );
    return cancelEvent( e );
  };

  const panLeft = e =>
  {
    panBy( -pan_step, 0, true );
    return cancelEvent( e );
  };

  const panRight = e =>
  {
    panBy( pan_step, 0, true );
    return cancelEvent( e );
  };

  const panUp = e =>
  {
    panBy( 0, -pan_step, true );
    return cancelEvent( e );
  };

  const panDown = e =>
  {
    panBy( 0, pan_step, true );
    return cancelEvent( e );
  };

  const zoomIn = e =>
  {
    zoomBy( 1 + zoom_step, true );
    return cancelEvent( e );
  };

  const zoomOut = e =>
  {
    zoomBy( 1 - zoom_step, true );
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

  // set map zoom
  const zoomBy = ( z = 1, smooth = false ) =>
  {
    if ( isNaN( z ) ) return;

    // zoom in to centre of window
    const x = window.innerWidth / 2,
          y = window.innerHeight / 2

    // zoom to desired level
    smooth
      ? pz.smoothZoom( x, y, z )
      : pz.zoomTo( x, y, z );
  }

  // set map zoom
  const zoomTo = ( z = 1, smooth = false ) =>
  {
    if ( isNaN( z ) || typeof window == 'undefined' || !pz ) return;

    // zoom in to centre of window
    const x = window.innerWidth / 2,
          y = window.innerHeight / 2

    // zoom to desired level
    smooth
      ? pz.smoothZoomAbs( x, y, z )
      : pz.zoomAbs( x, y, z);
  }

  // pan map by
  const panBy = ( x = 0, y = 0, smooth = false ) =>
  {
    if ( isNaN( x ) || isNaN( y ) ) return;
    pz.moveBy( x, y, smooth );
  }

  // pan map to
  const panTo = ( x = 0, y = 0, smooth = false ) =>
  {
    if ( isNaN( x ) || isNaN( y ) ) return;
    smooth
      ? pz.smoothMoveTo( x, y )
      : pz.moveTo( x, y);
  };
  
  /*
  zoom.subscribe( z => {
    if ( pz )
    {
      if ( config.log.zoom )
      {
        console.log( 'z changed', z, save );
      }
      
      save = false;
      zoomTo( z, true ) ;
      pz.on( 'zoomend.save', () => 
      {
        save = true;
        pz.off( 'zoomend.save' );
      } );
    }
  } );
  */

</script>

<svelte:window  on:keyup={ onKeyUp }/>

<div bind:this={root} class={ `panzoom ${$$props.class || ''}` }>
  <slot/>
</div>