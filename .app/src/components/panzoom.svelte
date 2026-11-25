 <script>
  
  import { onMount, onDestroy } from 'svelte';
  import { view } from '@stores/view';
  import panzoom from 'panzoom';
  import { zoom } from '@stores/zoom'
  import { visible } from '@stores/visible';
  import { debounce } from '@lib/debounce';
  import { grid } from '@stores/grid';
  import { link } from '@stores/link';

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
      // viewport size the current view was laid out for, used to keep the centre on resize
      viewport = { width: 0, height: 0 };

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

    // add a short delay
    setTimeout( () =>
    {
      loadTransform();
      viewport = getViewport();

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

  // save the map centre in the shareable link
  const saveTransform = () =>
  {
    const t = pz.getTransform();
    link.write( {
      x: ( window.innerWidth / 2 - t.x ) / t.scale,
      y: ( window.innerHeight / 2 - t.y ) / t.scale,
      zoom: t.scale
    } );
  }

  /**
   * Show the view from a shared link: its map point at the centre of the screen, at its zoom.
   *
   * @returns {boolean} Whether the link had a view to show.
   */
  const loadLinkedView = () =>
  {
    const { x, y, zoom: scale } = link.initial;
    if ( scale === null ) return false;

    pz.zoomAbs( 0, 0, scale );
    pz.moveTo( window.innerWidth / 2 - x * scale, window.innerHeight / 2 - y * scale );
    return true;
  }

  // show the view from a shared link (also a reload), or else the whole map; a view of an
  // earlier visit is not restored, because it was laid out for that screen
  const loadTransform = () =>
  {
    if ( !loadLinkedView() ) centerMap();
  }

  /**
   * Scale at which a box of the map fits the screen, within the zoom limits.
   *
   * @param {number} width  Box width in map pixels.
   * @param {number} height Box height in map pixels.
   * @param {number} margin Room around the box: 1.2 leaves 20% of empty space.
   * @param {number} [covered] Screen width covered by a panel, in CSS pixels (0).
   * @returns {number} Scale.
   */
  const fitScale = ( width, height, margin = 1, covered = 0 ) =>
  {
    const scale = Math.min(
      ( window.innerWidth - covered ) / ( width * margin ),
      window.innerHeight / ( height * margin )
    );
    return Math.min( zoom.max, Math.max( zoom.min, scale ) );
  }

  // running view animation, so a new one can cancel it
  let animation = 0;

  /**
   * Put a map point at the centre of the screen at a scale, optionally animated.
   *
   * @param {number} x        Map x in map pixels.
   * @param {number} y        Map y in map pixels.
   * @param {number} scale    Target scale.
   * @param {number} duration Animation length in milliseconds; 0 jumps straight there.
   * @returns {void}
   */
  const showPoint = ( x, y, scale, duration = 0 ) =>
  {
    cancelAnimationFrame( animation );

    const t = pz.getTransform(),
          ww = window.innerWidth,
          wh = window.innerHeight,
          // map point at the screen centre now
          from = { x: ( ww / 2 - t.x ) / t.scale, y: ( wh / 2 - t.y ) / t.scale, scale: t.scale },
          start = performance.now();

    const step = now =>
    {
      const progress = duration ? Math.min( 1, ( now - start ) / duration ) : 1,
            // ease in and out
            k = progress < .5 ? 2 * progress * progress : 1 - Math.pow( -2 * progress + 2, 2 ) / 2,
            // zoom geometrically so zooming in and out feel equally fast
            s = from.scale * Math.pow( scale / from.scale, k ),
            cx = from.x + ( x - from.x ) * k,
            cy = from.y + ( y - from.y ) * k;

      pz.zoomAbs( 0, 0, s );
      pz.moveTo( ww / 2 - cx * s, wh / 2 - cy * s );

      if ( progress < 1 ) animation = requestAnimationFrame( step );
    };
    step( start );
  }

  /**
   * Fit the whole map on screen.
   *
   * @param {boolean} smooth Animate the change.
   * @returns {void}
   */
  const centerMap = ( smooth = false ) =>
  {
    showPoint( grid.width / 2, grid.height / 2, fitScale( grid.width, grid.height ), smooth ? 400 : 0 );
  }

  /**
   * Show what the view store asks for: a box that must fit on screen, or a point at a scale.
   *
   * @param {object|null} request View request from the view store.
   * @returns {void}
   */
  const onViewRequest = request =>
  {
    if ( !request || !pz ) return;

    const inset = usableInset( request.inset ),
          scale = request.box
            ? fitScale( request.box.width, request.box.height, 1.3, inset.left + inset.right )
            : Math.min( zoom.max, Math.max( zoom.min, request.scale ) );
    // the point goes in the middle of the part of the screen no panel covers
    showPoint( request.x + ( inset.right - inset.left ) / 2 / scale, request.y, scale, 500 );
  }

  /**
   * The screen width a view request leaves to a panel on the left and the right, or none when
   * too little of the screen would be left (a panel over the whole width on a phone).
   *
   * @param {{ left: number, right: number }|undefined} inset Covered widths in CSS pixels.
   * @returns {{ left: number, right: number }} The covered widths to keep clear.
   */
  const usableInset = inset =>
  {
    if ( !inset ) return { left: 0, right: 0 };
    const left = Math.max( 0, inset.left || 0 ),
          right = Math.max( 0, inset.right || 0 );
    return window.innerWidth - left - right < window.innerWidth * .4 ? { left: 0, right: 0 } : { left, right };
  }

  onDestroy( view.request.subscribe( onViewRequest ) );

  /**
   * Carry out a command of the map control buttons (map-controls.svelte).
   *
   * @param {object|null} command Command from the view store.
   * @returns {void}
   */
  const onCommand = command =>
  {
    if ( !command || !pz ) return;
    if ( command.type === 'reset' ) centerMap( true );
    // looking right moves the map left, as with the arrow keys
    if ( command.type === 'look' ) panBy( -command.x * pan_step, -command.y * pan_step, true );
    if ( command.type === 'zoom' )
    {
      const t = pz.getTransform();
      showPoint( ( window.innerWidth / 2 - t.x ) / t.scale, ( window.innerHeight / 2 - t.y ) / t.scale, Math.min( zoom.max, Math.max( zoom.min, command.scale ) ) );
    }
  };

  onDestroy( view.command.subscribe( onCommand ) );

  /**
   * Current size of the browser viewport.
   *
   * @returns {{ width: number, height: number }} Width and height in CSS pixels.
   */
  const getViewport = () => ( { width: window.innerWidth, height: window.innerHeight } );

  /**
   * Keep the map point at the centre of the screen at the centre after a resize or rotation,
   * at the same zoom, then refresh the zoom store, visible hexes and saved view.
   *
   * @returns {void}
   */
  const onResize = () =>
  {
    if ( !root || !pz ) return;

    const next = getViewport();
    if ( viewport.width && viewport.height )
    {
      const t = pz.getTransform(),
            // map point that was at the centre of the old viewport
            cx = ( viewport.width / 2 - t.x ) / t.scale,
            cy = ( viewport.height / 2 - t.y ) / t.scale;

      pz.moveTo( next.width / 2 - cx * t.scale, next.height / 2 - cy * t.scale );
    }
    viewport = next;
    onPanzoomUpdate();
  }

  // resizing fires many events; handle the last one
  const onResizeDebounced = debounce( onResize, 100 );

  // listen to keyboard events for pan & zoom
  const onKeyUp = e =>
  {
    if ( !root || !pz ) return;
    // keys typed into a form field (the search box) are not map controls
    if ( e.target.closest && e.target.closest( 'input, textarea, select, [contenteditable]' ) ) return;
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

  // reset map
  const panCenter = e =>
  {
    centerMap( true );
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

  // pan map by
  const panBy = ( x = 0, y = 0, smooth = false ) =>
  {
    if ( isNaN( x ) || isNaN( y ) ) return;
    pz.moveBy( x, y, smooth );
  }

</script>

<svelte:window on:keyup={ onKeyUp } on:resize={ onResizeDebounced }/>

<div bind:this={root} class={ `panzoom ${$$props.class || ''}` }>
  <slot/>
</div>