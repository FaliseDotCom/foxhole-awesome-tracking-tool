<script>

  /**
   * The road network as a map layer, switched on in Settings; loaded when first shown
   */

  import { onMount } from 'svelte'
  import { roads } from '@stores/roads'

  /**
   * Every road as one path.
   * @type {import('svelte/store').Readable<string>}
   */
  const path = roads.path;

  onMount( () => roads.load() );

</script>

{#if $path}
  <path class="roads" d={ $path }/>
{/if}
