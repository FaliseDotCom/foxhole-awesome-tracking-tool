<script>

  /**
   * Legend: region colours, icon colours, and every structure type on the map
   */

  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import { legend } from '@stores/legend'

  // town hall tier 3 in each state, as colour examples
  const town = 58,
        examples = [
          { label: 'Wardens', item: { i: town, t: 'W', f: 0 } },
          { label: 'Colonials', item: { i: town, t: 'C', f: 0 } },
          { label: 'Neutral', item: { i: town, t: '', f: 0 } },
          { label: 'Scorched', item: { i: town, t: '', f: 0x10 } }
        ];

</script>

<div class="legend-section">
  <h3>Regions</h3>
  <div class="legend-row"><span class="legend-swatch team-W"></span>Held by the Wardens</div>
  <div class="legend-row"><span class="legend-swatch team-C"></span>Held by the Colonials</div>
  <div class="legend-row"><span class="legend-swatch scorched"></span>Scorched</div>
</div>

<div class="legend-section">
  <h3>Colors</h3>
  {#each examples as { label, item } ( label )}
    <div class="legend-row">
      <img src={ icons.getIcon( item, $settings.icons ) } alt="" width="20" height="20"/>{ label }
    </div>
  {/each}
</div>

{#if $legend.length}
  <div class="legend-section">
    <h3>Structures</h3>
    {#each $legend as type ( type.name )}
      <div class="legend-row">
        <img src={ icons.getIcon( { i: type.id }, $settings.icons ) } alt="" width="20" height="20"/>
        <span>
          { type.name }
          {#if type.aliases}<span class="legend-alias">{ type.aliases }</span>{/if}
        </span>
      </div>
    {/each}
  </div>
{/if}

<p class="legend-note">
  Zoomed out, only victory towns, rocket sites and scorched structures are shown. Hover over an
  icon to see what it is.
</p>
