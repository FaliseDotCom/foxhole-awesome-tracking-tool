<script>
  import { world } from '@stores/world'
	import { beforeUpdate, afterUpdate, onDestroy  } from 'svelte';
	import Hex from './hex.svelte';

  export let name = '',
             data = {}

  // only update hex data with matching name
  const unsubscribe = world.subscribe( ( d = {} ) => {
    const id = name.replace( 'Hex', '' )
		if ( d && id in d ) data = d[ id ]
	})

  onDestroy( unsubscribe )
             
</script>

<Hex class={ `data ${$$props.class || ''}` } { name }>
  <!-- explicit set slot on svg otherwise children won't be added -->
  <slot></slot>
</Hex>