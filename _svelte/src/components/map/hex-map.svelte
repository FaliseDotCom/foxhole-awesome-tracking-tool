<script>  

  /**
   * Map without layers
   */

  import PanZoom from '@components/panzoom.svelte'
  import SvgMap from '@components/map/map-svg.svelte'
  import Hex from '@components/map/hex/full.svelte'
  import Dynamic from './hex/dynamic.svelte'; 
  import { grid } from '@stores/grid'
</script>

{#if grid  && Array.isArray( grid.items ) }
<PanZoom>
  <SvgMap>
    {#each grid.items as name ( name ) }
      <Hex { name }/>
    {/each}
  </SvgMap>
</PanZoom>
{/if}