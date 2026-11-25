<script>

  import { icons } from '@stores/icons.js'
  import { settings } from '@stores/settings'
  import { tooltip } from '@stores/tooltip'
  import { search } from '@stores/search'
  import { structures } from '@stores/structures'
  import { grid } from '@stores/grid'
  import { fade } from 'svelte/transition';

  export let data = null,
             // hex key in the world data, for naming the nearest place in the tooltip
             name = '';

  // recalculated on every update so team and flag changes show without a remount
  $: x = data ? `${ data.x * 100 }%` : '';
  $: y = data ? `${ data.y * 100 }%` : '';
  $: href = data ? icons.getIcon( data, $settings.icons ) : '';
  $: title = data ? icons.getTitle( data ) : '';

  /**
   * Counts every time the pointer enters or leaves, so history that arrives after the pointer
   * moved on is dropped.
   * @type {number}
   */
  let hover = 0;

  /**
   * Show the tooltip; the place is only looked up when the pointer reaches the icon, and since
   * when the structure is what it is is added when the server answers.
   *
   * @param {PointerEvent} e Pointer event.
   * @returns {Promise<void>}
   */
  const onEnter = async e =>
  {
    const token = ++hover;
    tooltip.show( title, name ? search.placeOf( name, data ) : '', e );
    const lines = await structures.describe( name ? grid.id( name ) : '', data );
    if ( token === hover && lines.length ) tooltip.extend( lines );
  };

  /**
   * Hide the tooltip.
   *
   * @returns {void}
   */
  const onLeave = () =>
  {
    hover++;
    tooltip.hide();
  };

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
    on:pointerleave={ onLeave }
  />
{/if}
