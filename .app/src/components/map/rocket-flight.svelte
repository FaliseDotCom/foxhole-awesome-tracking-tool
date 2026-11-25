<script>

  /**
   * A fired rocket's trajectory: the arc is drawn from the launch site while the rocket, a
   * glowing head, flies along it. One progress value drives both, measured along the length of
   * the arc, so the head is always at the end of the line. Under "reduce motion" the arc is
   * drawn at once, without the head.
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
   * Share of the arc flown, 0 at the launch site and 1 at the impact.
   * @type {import('svelte/motion').Tweened<number>}
   */
  const flight = tweened( 0, { duration, easing: cubicIn } );

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
    flight.set( 1, still ? { duration: 0 } : {} );
  } );

  /**
   * Where the head is now, on the arc at the share flown; null once it landed.
   * @type {DOMPoint|null}
   */
  $: head = length && $flight < 1 ? path.getPointAtLength( $flight * length ) : null;

</script>

<path
  bind:this={ path }
  class="rocket-arc"
  class:measured={ length > 0 }
  { d }
  style:stroke-dasharray={ length ? `${ length } ${ length }` : null }
  style:stroke-dashoffset={ length ? length * ( 1 - $flight ) : null }
/>
{#if head}
  <circle class="rocket-head" cx={ head.x } cy={ head.y }/>
{/if}
