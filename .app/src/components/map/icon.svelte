<script>

  import { icons } from '@stores/icons.js'
  import { settings } from '@stores/settings'
  import { tooltip } from '@stores/tooltip'
  import { search } from '@stores/search'
  import { fade } from 'svelte/transition';

  export let data = null,
             // hex key in the world data, for naming the nearest place in the tooltip
             name = '';

  // recalculated on every update so team and flag changes show without a remount
  $: x = data ? `${ data.x * 100 }%` : '';
  $: y = data ? `${ data.y * 100 }%` : '';
  $: href = data ? icons.getIcon( data, $settings.icons ) : '';
  $: title = data ? icons.getTitle( data ) : '';

  // the place is only looked up when the pointer reaches the icon
  const onEnter = e => tooltip.show( title, name ? search.placeOf( name, data ) : '', e );

</script>
{#if data && href}
  <!-- the tooltip is for mouse users; screen readers get the same text from aria-label -->
  <image
    { x }
    { y }
    { href }
    class={ icons.getCss( data ) }
    transition:fade
    role="img"
    aria-label={ title }
    on:pointerenter={ onEnter }
    on:pointermove={ tooltip.move }
    on:pointerleave={ tooltip.hide }
  />
{/if}
