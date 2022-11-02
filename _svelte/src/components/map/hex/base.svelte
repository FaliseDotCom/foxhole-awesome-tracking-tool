<script>
  
  /**
   *  Base hex
   */

  import { grid } from '@stores/grid'
	import { visible } from '@stores/visible'
	import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  export let name = ''
             
  const bounds = grid.bounds( name )
  let show = true;

  const unsubscribe = visible.subscribe( v => {
    show = visible.getVisible( name ) !== false;
    // console.log( 'update visible', name, show )    
  })

  onDestroy( unsubscribe )
</script>

{#if show}
  <svg {...bounds} class={ `hex ${name} ${$$props.class || ''}` } in:fade|local>
    <slot/>
  </svg>
{/if}