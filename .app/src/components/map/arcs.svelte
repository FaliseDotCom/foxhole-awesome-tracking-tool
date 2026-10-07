<script>

  /**
   * Rocket trajectories: an arc from launch site to impact for every rocket in the war log
   */

  import { warlog } from '@stores/warlog'
  import RocketHead from './rocket-head.svelte'

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

{#each $rockets as rocket ( rocket.id )}
  <g class="rocket">
    <path class="rocket-arc" d={ arcPath( rocket.from, rocket ) } pathLength="1"/>
    <circle class="rocket-site" cx={ rocket.from.x } cy={ rocket.from.y }/>
    <circle class="rocket-impact" cx={ rocket.x } cy={ rocket.y }/>
    <RocketHead from={ rocket.from } to={ rocket } control={ controlPoint( rocket.from, rocket ) }/>
  </g>
{/each}
