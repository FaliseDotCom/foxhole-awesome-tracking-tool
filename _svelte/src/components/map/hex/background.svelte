<script>

  /**
   * Hex with background map image
   */
  
  import { config } from '@stores/config.js'
	import Hex from './base.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';
  export let name = ''

  const ext = 'webp', // used to be png
        map = name.toLowerCase().replace( 'hex', '' ).replace( 'map', '' ),
        href= `${ config.urls.maps }/${ map }.${ ext }`,
        title = grid.title( name )
</script>

<Hex name={ name } class={ `background ${$$props.class || ''}` } toggle={ false }>
  <image {href} height="100%" width="100%" clip-path="url(#clipPoly)"/>
  <text x="50%" y="50%">{ title }</text>
  <Polygon class="border"/>
  <slot/>
</Hex>