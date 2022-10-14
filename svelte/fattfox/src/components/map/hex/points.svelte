<script>

  /**
   * Hex that displays area points with their corresponding key, for debugging only
   */

	import Hex from './base.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';

  export let name = ''

        // get polygons by name
  const points = grid.getPoints( name ),
        // get keys for the loop
        keys = points ? Object.keys( points ) : null
  
  // click shows coordinates in console
  const onClick = e =>
  {       
          // get absolute position and size
    const r = e.target.getBoundingClientRect(),
          // get realive (unscaled) size
          b = e.target.getBBox(),
          // horizontal scale
          w = r.width / b.width,
          // vertical scale
          h = r.height / b.height,
          // calculate relative x ( x within element with regards to scale and width )
          x = ( e.clientX - r.x ) / ( b.width * w ),
          // calculate relative y ( y within element with regards to scale and height )
          y = ( e.clientY - r.y ) / ( b.height * h ),
          // number of characters per coordinate; 2 + decimals
          d = 5
    
    // log the results as a ready to use string; max 3 decimals
    console.log( name + ' point: ' + String( x ).substring( 0, d ) + ' ' + String( y ).substring( 0, d ) );
  }

</script>

{#if points && keys}
  <Hex class={ `points ${$$props.class || ''}` } {name} >       
    {#each keys as key }
      <circle cx={ `${ points[key].x }px` } cy={ `${ points[key].y }px` } r="3" fill="red"/>
      <text x={ `${ points[key].x }px` } y={ `${ points[key].y + 15 }px` } fill="red">{ key }={ points[key].fx },{ points[key].fy }</text>
    {/each}  
    <Polygon on:click={ onClick } class={ 'clicker ' + name }/>
  </Hex>
{/if}