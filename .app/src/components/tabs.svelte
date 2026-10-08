<script>

  /**
   * Tabs at the top right: war log, stats, legend, settings, and the shard picker when there is more
   * than one live shard. One panel at a time opens below the tabs; clicking the open tab, or
   * Escape, closes it.
   */

  import { onMount } from 'svelte';
  import Warlog from '@components/warlog.svelte'
  import Legend from '@components/legend.svelte'
  import Settings from '@components/settings.svelte'
  import Shard from '@components/shard.svelte'
  import Stats from '@components/stats.svelte'
  import { warlog } from '@stores/warlog'
  import { shards } from '@stores/shards'
  import Icon from '@components/icon.svelte'
  import { analytics } from '@stores/analytics'

  const unseen = warlog.unseen,
        available = shards.available;

  // the live shards are needed whether or not the shard tab shows
  onMount( () => shards.load() );

  $: tabs = [
    { key: 'warlog', title: 'Log', icon: 'list', component: Warlog },
    { key: 'stats', title: 'Stats', icon: 'chart', component: Stats },
    { key: 'legend', title: 'Legend', icon: 'legend', component: Legend },
    { key: 'settings', title: 'Settings', icon: 'settings', component: Settings },
    ...( $available.length > 1 ? [ { key: 'shard', title: 'Shard', icon: 'shard', component: Shard } ] : [] )
  ];

  // open tab, or empty when closed; purely local UI state. The war log starts open on wide
  // screens, where it fits next to the map
  let open = typeof window !== 'undefined' && window.innerWidth > 760 ? 'warlog' : '';

  $: current = tabs.find( tab => tab.key === open );

  // entries arriving while the war log is open count as seen
  $: if ( open === 'warlog' && $unseen ) warlog.markSeen();

  // newest major entry, read out by screen readers whichever tab is open
  $: announcement = $warlog.find( entry => entry.major );

  /**
   * Open a tab and count it.
   *
   * @param {string} key Tab key.
   * @returns {void}
   */
  const show = key =>
  {
    open = key;
    analytics.tab( key );
  };

  const toggle = key => open === key ? open = '' : show( key );

  /**
   * Arrow keys move between tabs, as in the ARIA tabs pattern.
   *
   * @param {KeyboardEvent} e Key event on a tab.
   * @param {number} index Index of that tab.
   * @returns {void}
   */
  const onTabKey = ( e, index ) =>
  {
    if ( e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' ) return;
    e.preventDefault();
    const next = ( index + ( e.key === 'ArrowRight' ? 1 : -1 ) + tabs.length ) % tabs.length;
    show( tabs[ next ].key );
    e.currentTarget.parentElement.children[ next ].focus();
  };

</script>

<svelte:window on:keydown={ e => { if ( e.key === 'Escape' && !e.target.closest( 'input' ) ) open = '' } }/>

<div class="tabs">
  <div class="tab-list" role="tablist" aria-label="Panels">
    {#each tabs as tab, index ( tab.key )}
      <button
        type="button"
        role="tab"
        id={ `tab-${ tab.key }` }
        class="tab"
        class:active={ open === tab.key }
        aria-selected={ open === tab.key }
        aria-controls="tab-panel"
        tabindex={ open === tab.key || ( !open && index === 0 ) ? 0 : -1 }
        on:click={ () => toggle( tab.key ) }
        on:keydown={ e => onTabKey( e, index ) }
        title={ tab.title }
      >
        <Icon name={ tab.icon }/>
        <!-- hidden on small screens, but still the tab's name for screen readers -->
        <span class="tab-label">{ tab.title }</span>
        {#if tab.key === 'warlog' && open !== 'warlog' && $unseen}
          <span class="tab-badge" aria-label={ `${ $unseen } new` }>{ $unseen }</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if current}
    <div class="panel tab-panel" id="tab-panel" role="tabpanel" aria-labelledby={ `tab-${ current.key }` }>
      <svelte:component this={ current.component }/>
    </div>
  {/if}

  <div class="visually-hidden" aria-live="polite">
    {#if announcement}{ announcement.team } { announcement.text } { announcement.place }{/if}
  </div>
</div>
