<script>

  /**
   * Tooltip next to the pointer for the structure under it; above the pointer for things at
   * the bottom of the screen, kept inside the window
   */

  import { tooltip } from '@stores/tooltip'

  /**
   * Space kept between a tooltip above the pointer and the window edge, in pixels.
   * @type {number}
   */
  const edge = 4;

  // rendered width, to keep a centred tooltip inside the window
  let width = 0,
      window_width = 0;

  $: left = $tooltip && $tooltip.above && width
    ? Math.min( Math.max( $tooltip.x, width / 2 + edge ), window_width - width / 2 - edge )
    : $tooltip ? $tooltip.x : 0;

  // below the pointer: to its left instead when it would run off the right edge
  $: flip = Boolean( $tooltip && !$tooltip.above && width && $tooltip.x + 14 + width > window_width - edge );

</script>

<svelte:window bind:innerWidth={ window_width }/>

{#if $tooltip}
  <div class="tooltip" class:above={ $tooltip.above } class:flip bind:clientWidth={ width } style:left={ `${ left }px` } style:top={ `${ $tooltip.y }px` } aria-hidden="true">
    <div class="tooltip-title">{ $tooltip.title }</div>
    {#if Array.isArray( $tooltip.detail )}
      {#each $tooltip.detail as line, index ( index )}
        <div class="tooltip-detail">{ line }</div>
      {/each}
    {:else if $tooltip.detail}
      <div class="tooltip-detail">{ $tooltip.detail }</div>
    {/if}
  </div>
{/if}
