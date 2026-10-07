<script>

  /**
   * Shard tab: pick one of the live shards. tabs.svelte only shows it when there is more than one
   */

  import { shards } from '@stores/shards'

  const available = shards.available;

</script>

<fieldset class="settings-group">
  <legend>Shard</legend>
  {#each $available as value ( value )}
    <label class="shard-option">
      <input type="radio" name="shard" { value } checked={ value == $shards } on:change={ () => shards.set( value ) }/>
      { value }
    </label>
  {/each}
</fieldset>
