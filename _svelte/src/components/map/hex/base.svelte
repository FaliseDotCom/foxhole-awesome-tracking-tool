<script>
  
  /**
   *  Base hex
   */

  import { grid } from '@stores/grid'
	import { visible } from '@stores/visible'
	import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  export let name = '',
             toggle = true;
             
  const bounds = grid.bounds( name )
  let show = true;

  if ( toggle )
  {
    const unsubscribe = visible.subscribe( () => {
      show = visible.getVisible( name ) !== false 
    })

    onDestroy( unsubscribe )
  }
</script>

{#if show}
  <svg {...bounds} class={ `hex ${name} ${$$props.class || ''}` } in:fade|local>
    <slot/>
  </svg>
{/if}