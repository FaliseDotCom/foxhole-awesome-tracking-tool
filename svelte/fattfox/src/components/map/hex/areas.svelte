<script>

  /**
   * Hex sub areas
   */

	import Hex from './hex.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';

  export let name = ''

        // get polygons by name
  const polys = grid.getPolygons( name ),
        // we only need values, not keys
        data = polys ? Object.values( polys ) : null
</script>

{#if data }
  <Hex class={ `areas ${$$props.class || ''}` } {name}>    
    <clipPath id="clip{name}">
      <Polygon/>
    </clipPath>
    {#each data as item }
      <polygon points={item} class="area" clip-path="url(#clip{name})" />
    {/each}  
  </Hex>
{/if}