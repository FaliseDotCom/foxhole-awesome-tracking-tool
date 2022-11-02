 <script>
  import { fade } from 'svelte/transition';
	import { grid } from '@stores/grid'
  import Hex from '@components/map/hex/base.svelte' 

  export let component = Hex,
             show = false;
</script>

{#if show}
<svg class={ `layer ${$$props.class || ''}` } transition:fade|local>
  <slot>
    {#if component && grid && Array.isArray( grid.items ) }
      {#each grid.items as name ( name ) }
        <svelte:component this={ component } {name}/>
      {/each}
    {/if}
  </slot>
</svg> 
{/if}