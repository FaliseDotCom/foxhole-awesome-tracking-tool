<script>

  /**
   * Rocket trajectories: an arc from launch site to impact for every rocket in the war log, and
   * a dashed arc from the armed site to every Rocket Target still counting down
   */

  import { warlog } from '@stores/warlog'
  import { rocketCountdowns } from '@stores/countdowns'
  import RocketFlight from './rocket-flight.svelte'

  /**
   * Rockets fired, from the war log, with their launch site in from.
   * @type {import('svelte/store').Readable<object[]>}
   */
  const rockets = warlog.rockets;

  /**
   * Control point of the arc from A to B: above the middle, a quarter of the distance away from
   * the straight line, so the curve reads as a trajectory.
   *
   * @param {{ x: number, y: number }} a Launch site in map pixels.
   * @param {{ x: number, y: number }} b Impact in map pixels.
   * @returns {{ x: number, y: number }} Control point.
   */
  const controlPoint = ( a, b ) =>
  {
    const dx = b.x - a.x,
          dy = b.y - a.y,
          // perpendicular to the line; flipped when needed so the arc always bulges upwards
          flip = dx < 0 ? -1 : 1;
    return {
      x: ( a.x + b.x ) / 2 + flip * dy * .25,
      y: ( a.y + b.y ) / 2 - flip * dx * .25
    };
  };

  /**
   * SVG path of the arc from A to B, a quadratic curve.
   *
   * @param {{ x: number, y: number }} a Launch site in map pixels.
   * @param {{ x: number, y: number }} b Impact in map pixels.
   * @returns {string} Path data.
   */
  const arcPath = ( a, b ) =>
  {
    const c = controlPoint( a, b );
    return `M ${ a.x } ${ a.y } Q ${ c.x } ${ c.y } ${ b.x } ${ b.y }`;
  };

</script>

{#each $rocketCountdowns as countdown ( `${ countdown.to.x }-${ countdown.to.y }` )}
  <g class="rocket rocket-countdown">
    {#if countdown.from}
      <path class="rocket-planned" d={ arcPath( countdown.from, countdown.to ) }/>
      <circle class="rocket-site" cx={ countdown.from.x } cy={ countdown.from.y }/>
    {/if}
    <circle class="rocket-target" cx={ countdown.to.x } cy={ countdown.to.y }/>
  </g>
{/each}

{#each $rockets as rocket ( rocket.id )}
  <g class="rocket">
    <circle class="rocket-site" cx={ rocket.from.x } cy={ rocket.from.y }/>
    <circle class="rocket-impact" cx={ rocket.x } cy={ rocket.y }/>
    <RocketFlight d={ arcPath( rocket.from, rocket ) }/>
  </g>
{/each}
