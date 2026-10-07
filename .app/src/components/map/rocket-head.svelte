<script>

  /**
   * The rocket itself: a glowing dot flying along its arc, in the time the arc takes to draw
   */

  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicIn } from 'svelte/easing';

  export let from = { x: 0, y: 0 },
             to = { x: 0, y: 0 },
             // the arc's control point
             control = { x: 0, y: 0 };

  // flight time; the same as the rocket-flight animation of the arc in map.css
  const flight = tweened( 0, { duration: 2000, easing: cubicIn } );

  onMount( () => flight.set( 1 ) );

  // point on the quadratic curve at progress t
  $: t = $flight;
  $: x = ( 1 - t ) * ( 1 - t ) * from.x + 2 * ( 1 - t ) * t * control.x + t * t * to.x;
  $: y = ( 1 - t ) * ( 1 - t ) * from.y + 2 * ( 1 - t ) * t * control.y + t * t * to.y;

</script>

{#if t < 1}
  <circle class="rocket-head" cx={ x } cy={ y }/>
{/if}
