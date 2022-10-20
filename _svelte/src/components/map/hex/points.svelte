<script>

  /**
   * Hex that displays area points with their corresponding key, for debugging only
   */

	import Hex from './data.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';
	import { world } from '@stores/world'
	import { afterUpdate } from 'svelte';

  export let name = ''

      // get polygons by name
  let points = grid.getPoints( name ),
      // abc as array
      letters = 'abcdefghijklmnopqrstuvwxyz'.split( '' ),
      // get default next letter; a if there's no keys, empty otherwise
      next_letter = '',
      // hex data
      data = null,
      // hex areas
      areas = [];

  const getNextLetter = () =>
  {
    next_letter = 'a';

    if ( !points ) return;

    const keys = Object.keys( points )

    if ( !keys ) return;

    letters.every( letter => {
      if ( !keys.includes( letter ) )
      {
        next_letter = letter;
        // break out of loop
        return false
      }
      // continue loop
      return true;
    });
  }
  getNextLetter();

  // after loading data, set area names once
  afterUpdate( () => {
    if ( !areas.length && data && Array.isArray( data.mapTextItems ) )
    {
      data.mapTextItems.forEach( item => {
        if ( item.mapMarkerType === 'Major' )
        {
          areas.push( item.text )
        }
      });
    }
  })
  
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
          // absolute coordinates in pixels
          x = e.clientX - r.x,
          y = e.clientY - r.y,
          // fractional coordinates relative to width & height (returns a number between 0 and 1)
          fx = x / ( b.width * w ),
          fy = y / ( b.height * h ),
          // number of characters per coordinate; 2 + decimals
          d = 5,
          // string data 
          raw = String( fx ).substring( 0, d ) + ' ' + String( fy ).substring( 0, d );
        
    // if next letter is know, show the entire list of points
    if ( next_letter )
    {      
      points = grid.addPoint( name, next_letter, raw )

      // build one big output string, one point per line
      let points_output = '';
      for( const [ key, coords ] of Object.entries( points ) )
      {
        points_output += `${key} : '${coords.raw}',` + "\n";
      }

      // log entire points list
      console.log( name + ' points:' );
      console.log( points_output );

      let area_output = areas.map( area => `"${area}" : '',` ).join( "\n" );
      console.log( name + ' areas:' );
      console.log( area_output );

      // points changed so get next letter 
      getNextLetter()
    }
    else
    {
      // log the results as a ready to use string if no letter is know
      console.log( name + ' point: ' + raw );
    }    
  }

</script>

{#if points }
  <Hex class={ `points ${$$props.class || ''}` } {name} once={ true } bind:data={ data }>       
    {#each Object.entries( points ) as [ key, point ] }
      <circle cx={ `${ point.x }px` } cy={ `${ point.y }px` } r="3" fill="red"/>
      <text x={ `${ point.x }px` } y={ `${ point.y + 15 }px` } fill="red">{ key }={ point.fx },{ point.fy }</text>
    {/each}  
    <Polygon on:click={ onClick } class={ 'clicker ' + name }/>
  </Hex>
{/if}