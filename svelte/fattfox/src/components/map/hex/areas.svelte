<script>
	import Hex from './hex.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';
  export let name = ''
  const areas = grid.areas( name ),
        data = areas ? Object.values( areas ) : null

 if ( data ) console.log( name, data )
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