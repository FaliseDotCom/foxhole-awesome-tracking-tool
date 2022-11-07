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
      version  = 0,
      scorched = 0;

  const log = config.log.dynamic;

  // check for updates
  afterUpdate( () =>
  {
    if ( log ) console.log( 'Dynamic: ' + name + ' update', data );

    if ( data && data.v !== version )
    {
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
          console.log( 'Dynamic: ' + name + ' updated from version ' + version + ' to ' + data.v + ' , ' + data.d.length + ' icons' )   

          if ( data.s !== scorched )
          {
            console.log( 'Dynamic: ' + name + ' updated scorched victory towns from ' + scorched + ' to ' + data.s ) 
          }
        }
      }     

      // store comparison data
      version = data.v;
      scorched = data.s;
    }
  });
</script>

<DataHex bind:data={ data } { name } class={ `dynamic ${$$props.class || ''}` }>
  { #if data && Array.isArray( data.d ) }
    { #each data.d as item ( item.key ) }
      <Icon data={ item }/>
    { /each }
    {#if animate}
      <Polygon class="flash" />
    {/if}
  {/if }
</DataHex>