<script>
  
  /**
   * Hex with static data; area labels and general points of interest
   */

	import Hex from './base.svelte';
  import world from '@stores/world_data.json'

  export let name = ''
  const data = name in world ? world[ name ] : null
</script>

{#if data }
<Hex { name } class={ `static ${$$props.class || ''}` }>
  { #each data.labels as label }
    <text x={ `${ label.x * 100 }%` } y={ `${ label.y * 100 }%` } class="minor">{ label.text }</text>
  { /each }
  { #each Object.entries( data.areas ) as [ name, area ] }
    <text x={ `${ area.x * 100 }%` } y={ `${ area.y * 100 }%` } class="major">{ name }</text>
  { /each }
</Hex>
{/if}