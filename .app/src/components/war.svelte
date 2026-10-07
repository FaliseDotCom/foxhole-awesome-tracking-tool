<script>

  /**
   * War overview, bottom centre: war number and day, and one bar of all victory towns: Wardens
   * from the left, Colonials from the right, unclaimed and scorched in between. Hover a part for
   * the numbers.
   */

  import { war } from '@stores/war'
  import { tooltip } from '@stores/tooltip'

  /**
   * Share of all victory towns, as a percentage.
   *
   * @param {number} count Victory towns.
   * @param {number} total All victory towns.
   * @returns {number} Percentage, 0 when there are none.
   */
  const percent = ( count, total ) => total ? count / total * 100 : 0;

  $: parts = $war ? [
    { key: 'wardens', title: 'Wardens', count: $war.wardens, need: true },
    { key: 'neutral', title: 'Unclaimed', count: $war.neutral, need: false },
    { key: 'scorched', title: 'Scorched', count: $war.scorched, need: false },
    { key: 'colonials', title: 'Colonials', count: $war.colonials, need: true }
  ] : [];


  /**
   * Tooltip text for a part of the bar.
   *
   * @param {object} part Bar part.
   * @returns {string} "24 of 75 victory towns (32%) · 34 needed to win".
   */
  const describe = part =>
  {
    let text = `${ part.count } of ${ $war.total } victory towns (${ Math.round( percent( part.count, $war.total ) ) }%)`;
    if ( part.need ) text += ` · ${ $war.required } needed to win`;
    if ( part.key === 'scorched' ) text += ' · each lowers the number needed by one';
    return text;
  };

</script>

{#if $war}
<div class="war" aria-label="War overview">
  <div class="war-title">War { $war.number }{ $war.day ? ` · day ${ $war.day }` : '' }</div>
  {#if $war.winner}
    <div class="war-winner">{ $war.winner } won</div>
  {:else}
    <div class="war-bar" role="img" aria-label={ `Victory towns: Wardens ${ $war.wardens }, Colonials ${ $war.colonials }, unclaimed ${ $war.neutral }, scorched ${ $war.scorched }; ${ $war.required } needed to win` }>
      {#each parts as part ( part.key )}
        {#if part.count}
          <div
            class={ `war-part ${ part.key }` }
            style:width={ `${ percent( part.count, $war.total ) }%` }
            on:pointerenter={ e => tooltip.show( part.title, describe( part ), e, true ) }
            on:pointermove={ tooltip.move }
            on:pointerleave={ tooltip.hide }
          >
            { part.need ? part.count : '' }
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
{/if}
