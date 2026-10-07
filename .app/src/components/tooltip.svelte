<script>

  /**
   * Tooltip next to the pointer for the structure under it
   */

  import { tooltip } from '@stores/tooltip'

</script>

{#if $tooltip}
  <div class="tooltip" style:left={ `${ $tooltip.x }px` } style:top={ `${ $tooltip.y }px` } aria-hidden="true">
    <div class="tooltip-title">{ $tooltip.title }</div>
    {#if $tooltip.detail}
      <div class="tooltip-detail">{ $tooltip.detail }</div>
    {/if}
  </div>
{/if}
