<script>

  /**
   * Hex shading chosen in Settings: red for fighting (casualties in the last hour, against the
   * busiest hex), or dark for recent changes (the last war log event, within 6 hours).
   */

  import Hex from './base.svelte';
  import Polygon from '../polygon.svelte';
  import { stats } from '@stores/stats'
  import { settings } from '@stores/settings'

  export let name = '';

  const shading = stats.shading;

  /**
   * Strongest shading, as fill opacity.
   * @type {number}
   */
  const max_opacity = .55;

  $: amount = ( $shading[ $settings.shading ] || {} )[ name ] || 0;

</script>

{#if amount > 0}
  <Hex { name } class={ `shade ${ $settings.shading }` } toggle={ false }>
    <Polygon fill-opacity={ ( amount * max_opacity ).toFixed( 2 ) }/>
  </Hex>
{/if}
