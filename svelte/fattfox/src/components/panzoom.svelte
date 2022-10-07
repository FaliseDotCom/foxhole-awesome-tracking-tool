<script>
  import { onMount } from 'svelte';
  import panzoom from 'panzoom';

  export let args = {}
  let root

  onMount(() => {
    panzoom( root, args )
  })

</script>

<div bind:this={root} class={ `panzoom ${$$props.class || ''}` }>
  <slot></slot>
</div>