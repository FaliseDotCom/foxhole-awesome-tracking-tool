<script>

  /**
   * Message when map data cannot be loaded
   */

  import { world } from '@stores/world'
  import { shards } from '@stores/shards'

  const status = world.status,
        available = shards.available,
        loaded = shards.loaded;

  $: message = $loaded && !$available.length
    ? 'No Foxhole shard is online right now.'
    : $status === 'error'
      ? 'War data is unavailable at the moment; retrying.'
      : '';

</script>

{#if message}
  <div class="panel status" role="status">{ message }</div>
{/if}
