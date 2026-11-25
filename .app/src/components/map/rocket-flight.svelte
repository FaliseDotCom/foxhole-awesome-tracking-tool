<script>

  /**
   * A fired rocket's trajectory: the arc is drawn from the launch site while the rocket, a
   * glowing head, flies along it. One progress value drives both, measured along the length of
   * the arc, so the head is always at the end of the line. The head grows from small to medium
   * as it lifts off, grows to the size of the impact circle as it lands, and then fades into
   * it. Under "reduce motion" the arc is drawn at once, without the head.
   */

  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicIn } from 'svelte/easing';

  /**
   * Path data of the arc, from the launch site to the impact, in map pixels.
   * @type {string}
   */
  export let d = '';

  /**
   * Flight time in ms; the same as flight_time in stores/warlog.js, which times the impact.
   * @type {number}
   */
  const duration = 2000;

  /**
   * The phases of the animation, in flight times: the head grows at launch until launch_end,
   * grows to the impact circle from land_start to the impact at 1, and fades into it until
   * fade_end.
   * @type {{ launch_end: number, land_start: number, fade_end: number }}
   */
  const phases = { launch_end: .25, land_start: .85, fade_end: 1.25 };

  /**
   * Time since the launch, in flight times: 1 at the impact, phases.fade_end when it is over.
   * @type {import('svelte/motion').Tweened<number>}
   */
  const clock = tweened( 0, { duration: duration * phases.fade_end } );

  /**
   * Share of a phase from start to end done at a moment, 0 to 1.
   *
   * @param {number} time  Moment, in flight times.
   * @param {number} start Start of the phase.
   * @param {number} end   End of the phase.
   * @returns {number} Share done.
   */
  const share = ( time, start, end ) => Math.min( 1, Math.max( 0, ( time - start ) / ( end - start ) ) );

  /**
   * Share of the arc flown, 0 at the launch site and 1 at the impact; slow at first, as a rocket
   * gathers speed.
   * @type {number}
   */
  $: flight = cubicIn( Math.min( 1, $clock ) );

  /**
   * The arc's path element, for measuring it.
   * @type {SVGPathElement|null}
   */
  let path = null;

  /**
   * Length of the arc in map pixels; 0 until measured, and the arc stays hidden until then.
   * @type {number}
   */
  let length = 0;

  onMount( () =>
  {
    length = path.getTotalLength();
    const still = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
    clock.set( phases.fade_end, still ? { duration: 0 } : {} );
  } );

  /**
   * Where the head is now, on the arc at the share flown; null once it faded.
   * @type {DOMPoint|null}
   */
  $: head = length && $clock < phases.fade_end ? path.getPointAtLength( flight * length ) : null;

</script>

<path
  bind:this={ path }
  class="rocket-arc"
  class:measured={ length > 0 }
  { d }
  style:stroke-dasharray={ length ? `${ length } ${ length }` : null }
  style:stroke-dashoffset={ length ? length * ( 1 - flight ) : null }
/>
{#if head}
  <circle
    class="rocket-head"
    cx={ head.x }
    cy={ head.y }
    style:--launch={ share( $clock, 0, phases.launch_end ) }
    style:--land={ share( $clock, phases.land_start, 1 ) }
    style:--fade={ 1 - share( $clock, 1, phases.fade_end ) }
  />
{/if}
