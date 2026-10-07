<script>
   /**
   * Data hex
   */

  import { world } from '@stores/world'
	import { onDestroy } from 'svelte';
	import Hex from './base.svelte';
  import { config } from '@stores/config.js'

  export let name = '',
             data = {}

  const log = config.log.data,
        id = name.replace( 'Hex', '' );

  let version = 0;

  // only update hex data with matching name
  const unsubscribe = world.subscribe( d => 
  {   
    // check for requirements
		if ( d && id in d && 'v' in d[ id ] )
    {
      // only update if versions are different
      if ( version !== d[ id ].v )
      {
        // if ( log && version ) console.log( 'Data: ' + name + ' updated from version ' + version + ' to ' + d[ id ].v );
        data = d[ id ];
        version = data.v;
      }
    }
    else if ( log ) 
    {
      console.log( 'Data: ' + name + ' reveived invalid data ', d );
    }
    // nothing to clean up yet but unsubscribe should be something
    return () => {}
	})
  
  onDestroy( unsubscribe )
             
</script>

<Hex class={ `data ${$$props.class || ''}` } { name }>
  <slot/>
</Hex>