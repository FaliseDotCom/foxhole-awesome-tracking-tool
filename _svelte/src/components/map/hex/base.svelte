<script>
  
  /**
   *  Base hex
   */

	import { grid } from '@stores/grid'
  export let name = '',
             type = 'svg';
             
  const bounds = grid.bounds( name )
</script>

{#if type === 'svg'}
  <svg {...bounds} class={ `hex ${name} ${$$props.class || ''}` }>
    <slot/>
  </svg>
{:else}
  <div 
    style={ `left: ${bounds.x}px; top: ${bounds.y}px; width: ${bounds.width}px; height: ${bounds.height}px;`} 
    class={ `hex ${name} ${$$props.class || ''}` }
  >
    <slot/>
  </div>
{/if}

<style>
  div.hex
  {
    position: absolute;
    border: 1px solid red;
  }
</style>