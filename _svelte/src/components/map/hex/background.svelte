<script>

  /**
   * Hex with background map image
   */
  
  import { config } from '@stores/config.js'
	import Hex from './base.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';
  export let name = ''

  const href= `${config.urls.maps}Map${name}.png`,
        title = grid.title( name )
</script>

<Hex name={ name } class={ `background ${$$props.class || ''}` }>
  <clipPath id="clip{name}">
    <Polygon/>
  </clipPath>
  <image {href} height="100%" width="100%" clip-path="url(#clip{name})"/>
  <text x="50%" y="50%">{ title }</text>
  <slot/>
</Hex>