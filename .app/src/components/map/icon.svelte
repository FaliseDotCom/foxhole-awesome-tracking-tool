<script>

  import { icons } from '@stores/icons.js'
  import { fade } from 'svelte/transition';

  export let data = null;

  // recalculated on every update so team and flag changes show without a remount
  $: x = data ? `${ data.x * 100 }%` : '';
  $: y = data ? `${ data.y * 100 }%` : '';
  $: href = data ? icons.getIcon( data ) : '';
  $: title = data ? icons.getName( data.i ) : '';

</script>
{#if data && href}
  <image { x } { y } { href } { title } class={ icons.getCss( data ) } transition:fade/>
{/if}