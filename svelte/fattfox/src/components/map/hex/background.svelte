<script>
	import Hex from './hex.svelte';
  import { grid } from '@stores/grid'
  export let name = ''

  const href= `./maps/Map${name}.png`,
        title = grid.title( name )
</script>

<Hex name={ name } class={ `background ${$$props.class || ''}` }>
  <image {href} height="100%" width="100%"/>
  <text x="50%" y="50%">{ title }</text>
  <slot/>
</Hex>