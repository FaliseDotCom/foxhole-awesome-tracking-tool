<script>

  /**
   * Shown while the map shows a past moment (chosen in the war log): when that was, and a way
   * back to the live map. Escape goes back too.
   */

  import { world } from '@stores/world'
  import Icon from '@components/icon.svelte'
  import { moment } from '@lib/time'

  const past = world.past;

</script>

<svelte:window on:keydown={ e => { if ( $past && e.key === 'Escape' && !e.target.closest( 'input' ) ) world.showLive() } }/>

{#if $past}
  <div class="panel history-bar" role="status">
    <Icon name="clock" size={ 16 }/>
    <span>Map as it was on <b>{ moment( $past.time ) }</b></span>
    <!-- counted as history by world.showLive() -->
    <button type="button" class="history-live" data-track-skip on:click={ () => world.showLive() }>Back to live</button>
  </div>
{/if}
