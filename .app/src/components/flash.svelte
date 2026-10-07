<script>

  /**
   * Full-screen flash when a rocket hits
   */

  import { effects } from '@stores/effects'

  const flash = effects.flash;

</script>

{#if $flash}
  <div class="effect-flash" aria-hidden="true"></div>
{/if}
