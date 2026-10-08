<script>

  /**
   * Legend: how the map works, region colours, icon colours, and every structure type on the
   * map, with a search field for the structures
   */

  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import { legend } from '@stores/legend'
  import FilterField from '@components/filter-field.svelte'

  const count = legend.count,
        query = legend.query;

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
  <h3>How the map works</h3>
  <p class="legend-note">
    Zoomed out, only victory towns, rocket sites and scorched structures are shown. Hover over an
    icon to see what it is.
  </p>
</div>

<div class="legend-section">
  <h3>Hex shading</h3>
  <div class="legend-row"><span class="legend-swatch shade-fighting"></span>Fighting: red by the casualties in the last hour, strongest on the busiest hex</div>
  <div class="legend-row"><span class="legend-swatch shade-changes"></span>Changes: darker the more recently something changed there, up to 6 hours ago</div>
  <p class="legend-note">Off by default; choose one under Hex shading in Settings. Hover a hex when zoomed out for its structures, casualties and latest changes.</p>
</div>

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

{#if $count}
  <div class="legend-section">
    <h3>Structures</h3>
    <FilterField
      icon="legend"
      label="Search the structures"
      placeholder="Search structures…"
      value={ $query }
      on:input={ e => legend.setQuery( e.detail ) }
    />
    {#if !$legend.length}
      <p class="legend-note">No structure matches “{ $query.trim() }”.</p>
    {/if}
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
