<script>  

  /**
   * Map without layers
   */

  import PanZoom from '@components/panzoom.svelte'
  import SvgMap from '@components/map/map-svg.svelte'
  import Hex from '@components/map/hex/full.svelte'
  import { grid } from '@stores/grid'
	import Scaler from '../scaler.svelte';
</script>

<Scaler>
  <PanZoom>
    {#if grid && Array.isArray( grid.items ) }
      <SvgMap>
        {#each grid.items as name ( name ) }
          <Hex { name }/>
        {/each}
      </SvgMap>
    {/if}
  </PanZoom>
</Scaler>