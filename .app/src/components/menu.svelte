<script>

  /**
   * Bottom-right menu that opens the legend or the settings
   */

  import Legend from '@components/legend.svelte'
  import Settings from '@components/settings.svelte'

  const panels = [
    { key: 'legend', title: 'Legend', component: Legend },
    { key: 'settings', title: 'Settings', component: Settings }
  ];

  // open panel key, or empty when closed; purely local UI state
  let open = '';

  const toggle = key => open = open === key ? '' : key;

  $: current = panels.find( panel => panel.key === open );

</script>

<svelte:window on:keydown={ e => { if ( e.key === 'Escape' ) open = '' } }/>

<div class="menu">
  {#if current}
    <div class="panel menu-panel" id="menu-panel" role="dialog" aria-label={ current.title }>
      <svelte:component this={ current.component }/>
    </div>
  {/if}
  <div class="menu-buttons">
    {#each panels as { key, title } ( key )}
      <button
        type="button"
        class:active={ open === key }
        aria-expanded={ open === key }
        aria-controls="menu-panel"
        on:click={ () => toggle( key ) }
      >{ title }</button>
    {/each}
  </div>
</div>
