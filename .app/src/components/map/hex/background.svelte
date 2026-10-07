<script>

  /**
   * Hex with background map image
   */
  
  import { config } from '@stores/config.js'
	import Hex from './base.svelte';
  import { grid } from '@stores/grid'
  import { settings } from '@stores/settings'
	import Polygon from '../polygon.svelte';
  export let name = ''

  const ext = 'webp', // used to be png
        map = name.toLowerCase().replace( 'hex', '' ).replace( 'map', '' ),
        title = grid.title( name )

  // the color set only covers the 37 hexes of 2022; others fall back to the complete set
  // style whose image failed to load for this hex
  let failed = '';

  $: style = failed === $settings.maps ? config.styles.maps[ 0 ] : $settings.maps
  $: href = `${ config.urls.maps }${ style }/${ map }.${ ext }`
</script>

<Hex name={ name } class={ `background ${$$props.class || ''}` } toggle={ false }>
  <image {href} height="100%" width="100%" clip-path="url(#clipPoly)" on:error={ () => failed = style }/>
  <text x="50%" y="50%">{ title }</text>
  <Polygon class="border"/>
  <slot/>
</Hex>