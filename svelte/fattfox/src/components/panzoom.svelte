<script>
  import { onMount } from 'svelte';
  import panzoom from 'panzoom';

  export let  args = {
                minZoom: .5,
                maxZoom: 8,
                filterKey: () => true
              },
              zoom_step = .5,
              pan_step = 100;

  let root = null,
      pz = null

  onMount(() => {
    pz = panzoom( root, args );
  })

  onMount( () =>
  {
    document.addEventListener( 'keyup', e =>
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
          // return panCenter( e );
      }
    });
  })

  // this one is buggy!
  const panCenter = e =>
  {
    // const c = getMapBounds();
    // panTo( c.x + c.width / 2, c.y + c.height / 2, true );
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

  const getZoom = () => pz.getTransform().scale;

  // set map zoom
  const zoomBy = ( z = 1, smooth = false,) =>
  {
    if ( isNaN( z ) ) return;

    // get rect so we can apply center
    const r = root.getBoundingClientRect(),
          s = getZoom(),
          x = r.x - ( r.width / 2 ) / s,
          y = r.y - ( r.height / 2 ) / s

    // zoom to desired level
    smooth
      ? pz.smoothZoom( x, y, z )
      : pz.zoomTo( x, y, z );
  }

  // set map zoom
  const zoomTo = ( z = 1, smooth = false,) =>
  {
    if ( isNaN( z ) ) return;
    // get rect so we can apply center
    const r = root.getBoundingClientRect()

    // zoom to desired level
    smooth
      ? pz.smoothZoomAbs( r.width / 2, r.height / 2, z )
      : pz.zoomAbs( r.width / 2, r.height / 2, z );
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

</script>

<div bind:this={root} class={ `panzoom ${$$props.class || ''}` }>
  <slot></slot>
</div>