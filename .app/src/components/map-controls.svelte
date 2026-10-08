<script>

  /**
   * Buttons to move the map, at the bottom on the logo's side: arrows to pan, a slider to zoom
   * (with zoom out and in buttons), and a button that fits the whole map. They do what the
   * keyboard does (arrows, + and -, numpad 5). Hidden on phones, which pan and zoom by touch.
   */

  import { view } from '@stores/view'
  import { zoom } from '@stores/zoom'
  import Icon from '@components/icon.svelte'

  // the slider is logarithmic: each step zooms by the same factor at every zoom level
  const low = Math.log( zoom.min ),
        high = Math.log( zoom.max );

  /**
   * Zoom by a factor around the screen centre.
   *
   * @param {number} factor More than 1 zooms in, less than 1 out.
   * @returns {void}
   */
  const zoomBy = factor => view.zoomTo( $zoom * factor );

  // the arrows, in a 3 × 3 grid around the fit button
  const arrows = [
    { name: 'up', label: 'Look up', x: 0, y: -1, area: 'up' },
    { name: 'left', label: 'Look left', x: -1, y: 0, area: 'left' },
    { name: 'right', label: 'Look right', x: 1, y: 0, area: 'right' },
    { name: 'down', label: 'Look down', x: 0, y: 1, area: 'down' }
  ];

</script>

<div class="panel map-controls" role="group" aria-label="Map controls" data-track="Map controls">
  <div class="map-pad">
    {#each arrows as arrow ( arrow.name )}
      <button type="button" class={ `map-button ${ arrow.area }` } title={ arrow.label } aria-label={ arrow.label } on:click={ () => view.look( arrow.x, arrow.y ) }>
        <Icon name={ arrow.name }/>
      </button>
    {/each}
    <button type="button" class="map-button fit" title="Show the whole map" aria-label="Show the whole map" on:click={ () => view.reset() }>
      <Icon name="fit"/>
    </button>
  </div>
  <div class="map-zoom">
    <button type="button" class="map-button" title="Zoom out" aria-label="Zoom out" on:click={ () => zoomBy( 1 / 1.5 ) }>
      <Icon name="minus"/>
    </button>
    <input
      type="range"
      min={ low }
      max={ high }
      step=".01"
      value={ Math.log( $zoom ) }
      aria-label="Zoom"
      on:input={ e => view.zoomTo( Math.exp( Number( e.target.value ) ) ) }
    />
    <button type="button" class="map-button" title="Zoom in" aria-label="Zoom in" on:click={ () => zoomBy( 1.5 ) }>
      <Icon name="plus"/>
    </button>
  </div>
</div>
