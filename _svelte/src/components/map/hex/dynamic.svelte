<script>

  /**
   * Hex with dynamically updated data
   */
  
	import { afterUpdate } from 'svelte';
	import DataHex from './data.svelte'
	import Polygon from '../polygon.svelte';
  import Icon from '../icon.svelte';
  import { config } from '@stores/config.js'

  export let name = '';

      // data will change as its loaded from server
  let data = null,
      // do an animation?
      animate = false,
      // this stores the last version of the data
      version = 0,
      scorched = 0,
      json = '';

  const log = config.log.hex;

  // check for updates
  afterUpdate( () =>
  {
    if ( data && data.v !== version )
    {
      const str = JSON.stringify( data );

      // skip initial update when version is zero
      if ( version && data.v !== version )
      {
        // start CSS animation
        animate = true;
        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 500 )
        
        if ( log )
        {
          console.log( name + ' updated from version ' + version + ' to ' + data.v )   

          if ( data.s !== scorched )
          {
            console.log( name + ' updated scorched victory towns from ' + scorched + ' to ' + data.s ) 
          }

          if ( json && json === str )
          {
            console.log( name + ' has NO updates' )  
          }
        }
      }     

      // store 'old' data
      version = data.v;
      scorched = data.s;
      json = str
    }
  });
</script>

<DataHex bind:data={ data } { name } class={ `dynamic ${$$props.class || ''}` }>
  { #if data && Array.isArray( data.d ) }
    { #each data.d as item ( `${item.x}-${item.y}` ) }
      <Icon data={ item } {name}/>
    { /each }
    {#if animate}
      <Polygon class="flash" />
    {/if}
  {/if }
</DataHex>