<script>

  /**
   * War overview, bottom centre: war number, day and players, key structures per team, and one
   * bar of all victory towns: Wardens from the left, Colonials from the right, unclaimed and
   * scorched in between. Hover a part or a counter for the numbers and places.
   */

  import { war } from '@stores/war'
  import { tooltip } from '@stores/tooltip'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import { config } from '@stores/config'

  /**
   * Places listed in a counter's tooltip; the rest are counted.
   * @type {number}
   */
  const max_places = 6;

  // Wardens on the left, Colonials on the right, as in the bar; emblems in assets/icons/factions
  const teams = [ { t: 'W', title: 'Wardens', key: 'wardens' }, { t: 'C', title: 'Colonials', key: 'colonials' } ];

  /**
   * Url of a faction emblem.
   *
   * @param {{ key: string }} team Team.
   * @returns {string} Image url.
   */
  const emblem = team => `${ config.urls.icons }factions/${ team.key }.png${ config.assetsQuery }`;

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

  /**
   * Tooltip text for a structure counter: the armed rockets, and where they are.
   *
   * @param {{ count: number, armed: number, places: string[] }} counter Counted structures of a team.
   * @returns {string} "1 armed · The Pits, Dead Lands · …", or "None".
   */
  const describeCounter = counter =>
  {
    if ( !counter.count ) return 'None';
    const shown = counter.places.slice( 0, max_places ),
          more = counter.places.length - shown.length;
    return [
      counter.armed ? `${ counter.armed } armed with a rocket` : '',
      ...shown,
      more ? `and ${ more } more` : ''
    ].filter( Boolean ).join( ' · ' );
  };

</script>

{#if $war}
<div class="war" aria-label="War overview" data-track="War">
  <div class="war-head">
    {#each teams as team, index ( team.t )}
      <ul class={ `war-counters ${ index ? 'colonials' : 'wardens' }` } aria-label={ `${ team.title } structures` }>
        {#each $war.counted as kind ( kind.key )}
          {@const counter = $war.structures[ team.t ][ kind.key ]}
          <li
            class="war-counter"
            class:armed={ counter.armed > 0 }
            aria-label={ `${ kind.title }: ${ counter.count }${ counter.armed ? `, ${ counter.armed } armed` : '' }` }
            on:pointerenter={ e => tooltip.show( `${ team.title }: ${ counter.count } ${ kind.title.toLowerCase() }`, describeCounter( counter ), e, true ) }
            on:pointermove={ tooltip.move }
            on:pointerleave={ tooltip.hide }
          >
            <img src={ icons.getIcon( { i: kind.types[ 0 ], t: team.t, f: 0 }, $settings.icons ) } alt="" width="22" height="22"/>
            <span>{ counter.count }</span>
          </li>
        {/each}
      </ul>
      {#if !index}
        <div class="war-title">
          War { $war.number }{ $war.day ? ` · day ${ $war.day }` : '' }
          {#if $war.players}
            <span class="war-players" title="Players in Foxhole right now according to Steam">· { $war.players.toLocaleString( 'en' ) } players</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
  <div class="war-body">
    <div class="war-faction wardens">
      <img src={ emblem( teams[ 0 ] ) } alt="" width="40" height="40"/>
      <span>Wardens</span>
    </div>
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
    <div class="war-faction colonials">
      <img src={ emblem( teams[ 1 ] ) } alt="" width="40" height="40"/>
      <span>Colonials</span>
    </div>
  </div>
</div>
{/if}
