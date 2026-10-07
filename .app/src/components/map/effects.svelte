<script>

  /**
   * Rocket effects on the map: a flashing beacon on a launch site, a shockwave at an impact
   */

  import { effects } from '@stores/effects'

  const markers = effects.markers;

</script>

{#each $markers as marker ( marker.id )}
  {#if marker.type === 'launch'}
    <g class="effect-launch">
      <circle class="effect-launch-glow" cx={ marker.x } cy={ marker.y }/>
      <circle class="effect-launch-ring" cx={ marker.x } cy={ marker.y }/>
    </g>
  {:else}
    <g class="effect-impact">
      <circle class="effect-impact-fireball" cx={ marker.x } cy={ marker.y }/>
      <circle class="effect-impact-wave" cx={ marker.x } cy={ marker.y }/>
      <circle class="effect-impact-wave late" cx={ marker.x } cy={ marker.y }/>
    </g>
  {/if}
{/each}
