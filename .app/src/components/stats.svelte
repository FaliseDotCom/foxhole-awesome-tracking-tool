<script>

  /**
   * Stats tab: players in the game, casualties per hour over the last day, and the hexes with
   * the most fighting in the last hour. Built from what the server recorded, so it fills up
   * over time.
   */

  import { stats } from '@stores/stats'
  import Chart from '@components/chart.svelte'

  /**
   * Hexes listed as most active.
   * @type {number}
   */
  const max_hexes = 8;

  const number = value => Math.round( value ).toLocaleString( 'en' );

  // the latest rate per hour of a casualty series, 0 without samples
  const latest = series => series.length ? series[ series.length - 1 ][ 1 ] : 0;

  $: active = $stats ? $stats.active.filter( hex => hex.total > 0 ).slice( 0, max_hexes ) : [];
  $: busiest = active.length ? active[ 0 ].total : 1;
  // less than an hour of samples: the numbers are still building up
  $: young = $stats && ( !$stats.since || $stats.now - $stats.since < 3600000 );

</script>

{#if !$stats}
  <p class="stats-note">No statistics yet. They are recorded every 5 minutes from now on.</p>
{:else}
  {#if young}
    <p class="stats-note">Statistics started recording less than an hour ago and fill up over time.</p>
  {/if}

  <section class="stats-section">
    <h3>Players</h3>
    <p class="stats-big">{ number( $stats.players ) } <span>in Foxhole now, all shards (Steam)</span></p>
    <Chart
      lines={ [ { points: $stats.playerSeries, class: 'players', title: '' } ] }
      unit="players"
      zero={ false }
      label="Players over the last 24 hours"
    />
  </section>

  <section class="stats-section">
    <h3>Casualties per hour</h3>
    <p class="stats-legend">
      <span class="stats-key wardens"></span>Wardens { number( latest( $stats.casualties.wardens ) ) }
      <span class="stats-key colonials"></span>Colonials { number( latest( $stats.casualties.colonials ) ) }
    </p>
    <Chart
      lines={ [
        { points: $stats.casualties.wardens, class: 'wardens', title: 'Wardens' },
        { points: $stats.casualties.colonials, class: 'colonials', title: 'Colonials' }
      ] }
      unit="per hour"
      label="Casualties per hour over the last 24 hours, per team"
    />
    {#if $stats.totals}
      <p class="stats-note">
        This war so far: { number( $stats.totals.wardens ) } Warden and { number( $stats.totals.colonials ) } Colonial
        casualties, { number( $stats.totals.enlistments ) } enlistments.
      </p>
    {/if}
  </section>

  <section class="stats-section">
    <h3>Most fighting, last hour</h3>
    {#if active.length}
      <ul class="stats-hexes">
        {#each active as hex ( hex.key )}
          <li>
            <button type="button" class="stats-hex" on:click={ () => stats.focusHex( hex.key ) }>
              <span class="stats-hex-name">{ hex.title }</span>
              <span class="stats-hex-numbers">{ number( hex.hour.wardens ) } / { number( hex.hour.colonials ) }</span>
              <!-- casualties per team, against the busiest hex -->
              <span class="stats-hex-bar" aria-hidden="true">
                <span class="wardens" style:width={ `${ hex.hour.wardens / busiest * 100 }%` }></span>
                <span class="colonials" style:width={ `${ hex.hour.colonials / busiest * 100 }%` }></span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
      <p class="stats-note">Warden / Colonial casualties. Click a hex to go there.</p>
    {:else}
      <p class="stats-note">No casualties recorded in the last hour.</p>
    {/if}
  </section>
{/if}
