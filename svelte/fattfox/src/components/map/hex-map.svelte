<script>  

  /**
   * Map without layers
   */

  import PanZoom from '@components/panzoom.svelte'
  import Map from '@components/map/map.svelte'
  import Hex from '@components/map/hex/full.svelte'
  import { grid } from '@stores/grid'
</script>

{#if grid  && Array.isArray( grid.items ) }
<PanZoom>
  <Map>
    {#each grid.items as n ( n ) }
      <Hex name={ n }/>
    {/each}
  </Map>
</PanZoom>
{/if}