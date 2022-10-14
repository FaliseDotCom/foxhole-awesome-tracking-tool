 <script>
	import { grid } from '@stores/grid'
  import Hex from '@components/map/hex/base.svelte' 
  export let component = Hex
</script>

<svg class={ `layer ${$$props.class || ''}` }>
  <slot>
    {#if component && grid && Array.isArray( grid.items ) }
      {#each grid.items as n ( n ) }
        <svelte:component this={ component } name={ n }/>
      {/each}
    {/if}
  </slot>
</svg> 