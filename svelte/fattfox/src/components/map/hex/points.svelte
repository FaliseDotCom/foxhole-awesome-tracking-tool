<script>

  /**
   * Display area points with their corresponding key, for debugging only
   */

	import Hex from './hex.svelte';
  import { grid } from '@stores/grid'

  export let name = ''

        // get polygons by name
  const points = grid.getPoints( name ),
        // get keys for the loop
        keys = points ? Object.keys( points ) : null

</script>

{#if points && keys}
  <Hex class={ `points ${$$props.class || ''}` } {name}>       
    {#each keys as key }
      <circle cx={ `${ points[key].x }px` } cy={ `${ points[key].y }px` } r="3" fill="red"/>
      <text x={ `${ points[key].x }px` } y={ `${ points[key].y + 15 }px` } fill="red">{ key }={ points[key].fx },{ points[key].fy }</text>
    {/each}  
  </Hex>
{/if}