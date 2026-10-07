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
<Hex { name } class={ `static minor ${$$props.class || ''}` }>
  {#each data.labels as label, index ( index )}
    <text x={ `${ label.x * 100 }%` } y={ `${ label.y * 100 }%` } class="minor">{ label.text }</text>
  {/each}
</Hex>
{/if}