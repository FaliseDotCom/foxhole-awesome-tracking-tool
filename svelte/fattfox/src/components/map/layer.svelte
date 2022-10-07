 <script>
	import { grid } from '@stores/grid'
  import Hex from '@components/map/hex/hex.svelte' 
  export let component = Hex
</script>

<svg class={ `layer ${$$props.class || ''}` }>
  <!-- explicit set slot on svg otherwise children won't be added -->
  <slot>
    {#if component }
      {#each grid.items as n ( n ) }
        <svelte:component this={ component } name={ n }/>
      {/each}
    {/if}
  </slot>
</svg> 