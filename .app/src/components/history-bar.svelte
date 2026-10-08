<script>

  /**
   * Shown while the map shows a past moment (chosen in the war log): when that was, and a way
   * back to the live map. Escape goes back too.
   */

  import { world } from '@stores/world'
  import Icon from '@components/icon.svelte'

  const past = world.past;

  /**
   * A moment as "8 Oct, 14:32".
   *
   * @param {number} time Moment in ms.
   * @returns {string} Day, month and time in the viewer's time zone.
   */
  const moment = time => new Date( time ).toLocaleString( 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } );

</script>

<svelte:window on:keydown={ e => { if ( $past && e.key === 'Escape' && !e.target.closest( 'input' ) ) world.showLive() } }/>

{#if $past}
  <div class="panel history-bar" role="status">
    <Icon name="clock" size={ 16 }/>
    <span>Map as it was on <b>{ moment( $past.time ) }</b></span>
    <button type="button" class="history-live" on:click={ () => world.showLive() }>Back to live</button>
  </div>
{/if}
