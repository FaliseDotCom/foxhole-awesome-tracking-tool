<script>

  /**
   * Pulsing ring on the place the map was moved to (by search)
   */

  import { view } from '@stores/view'
  import { zoom } from '@stores/zoom'

  const marker = view.marker;

  // keep the ring the same size on screen at every zoom
  $: radius = 30 / $zoom;

</script>

{#if $marker}
  <circle class="marker" cx={ $marker.x } cy={ $marker.y } r={ radius }/>
{/if}
