<script>

  /**
   * War overview: war number, day, and victory towns per team against the number needed
   */

  import { war } from '@stores/war'

</script>

{#if $war}
<div class="panel war" aria-label="War overview">
  <div class="war-title">War { $war.number }{ $war.day ? ` · day ${ $war.day }` : '' }</div>
  {#if $war.winner}
    <div class="war-winner">{ $war.winner } won</div>
  {:else}
    <div class="war-row team-wardens">
      <span>Wardens</span>
      <b>{ $war.wardens } / { $war.required }</b>
    </div>
    <div class="war-row team-colonials">
      <span>Colonials</span>
      <b>{ $war.colonials } / { $war.required }</b>
    </div>
    <!-- scorched victory towns count for nobody; each one lowers the number needed by one -->
    <div class="war-row scorched" title="Scorched victory towns count for nobody and lower the number needed to win">
      <span>Scorched</span>
      <b>{ $war.scorched }</b>
    </div>
    <div class="war-note">victory towns</div>
  {/if}
</div>
{/if}
