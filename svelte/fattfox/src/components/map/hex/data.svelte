<script>
  import { world } from '@stores/world'
	import { beforeUpdate, afterUpdate, onDestroy  } from 'svelte';
	import Hex from './hex.svelte';

  export let name = '',
             once = false,
             data = {}

  // only update hex data with matching name
  const unsubscribe = world.subscribe( ( d = {} ) => {
    const id = name.replace( 'Hex', '' )
		if ( d && id in d ) data = d[ id ]
	})

  onDestroy( unsubscribe )

  afterUpdate( () => 
  {
    // static data needs no updates 
    // so when once is true AND we've received data 
    // we can unsubscribe from the store
    if ( once && data ) 
    {
      unsubscribe()
    }
  })
             
</script>

<Hex class={ `data ${$$props.class || ''}` } { name }>
  <slot></slot>
</Hex>