<script>
   /**
   * Data hex
   */

  import { world } from '@stores/world'
	import { afterUpdate, onDestroy  } from 'svelte';
	import Hex from './base.svelte';

  export let name = '',
             once = false,
             type = 'svg',
             data = {}

  // only update hex data with matching name
  const unsubscribe = world.subscribe( ( d = {} ) => 
  {
    const id = name.replace( 'Hex', '' )
		if ( d && id in d ) data = d[ id ]
    // nothing to clean up yet but unsubscribe should be something
    return () => {}
	})

  const maybeUnsubscribe = () =>
  {
    if ( typeof unsubscribe == 'function' )
    {
      unsubscribe()
    } 
  }

  if ( !once )
  {
    onDestroy( maybeUnsubscribe )
  }

  afterUpdate( () => 
  {
    // static data needs no updates 
    // so when once is true AND we've received data 
    // we can unsubscribe from the store
    if ( once && data ) maybeUnsubscribe()
  })
             
</script>

<Hex class={ `data ${$$props.class || ''}` } { name } {type}>
  <slot/>
</Hex>