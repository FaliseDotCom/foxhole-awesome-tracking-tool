<script>

  /**
   * War log: changes in the war since the page was opened, newest first; click to go there
   */

  import { onMount, onDestroy } from 'svelte';
  import { warlog } from '@stores/warlog'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'

  const unseen = warlog.unseen,
        major_only = warlog.majorOnly,
        source = warlog.source;

  // purely local UI state: whether the panel is open, and a clock for "2 min ago"
  let open = typeof window !== 'undefined' && window.innerWidth > 760,
      now = Date.now(),
      clock = 0;

  onMount( () => clock = setInterval( () => now = Date.now(), 30000 ) );
  onDestroy( () => clearInterval( clock ) );

  // entries arriving while the panel is open count as seen
  $: if ( open && $unseen ) warlog.markSeen();

  // newest major entry, read out by screen readers
  $: announcement = $warlog.find( entry => entry.major );

  /**
   * How long ago something happened, roughly.
   *
   * @param {number} time Time in ms.
   * @param {number} current Current time in ms.
   * @returns {string} "just now", "5 min ago", "2 h ago".
   */
  const ago = ( time, current ) =>
  {
    const minutes = Math.floor( ( current - time ) / 60000 );
    if ( minutes < 1 ) return 'just now';
    if ( minutes < 60 ) return `${ minutes } min ago`;
    return `${ Math.floor( minutes / 60 ) } h ago`;
  };

  const teamClass = team => team ? `team-${ team.toLowerCase() }` : 'team-none';

</script>

<div class="warlog" class:open>
  <button
    type="button"
    class="warlog-toggle"
    aria-expanded={ open }
    aria-controls="warlog-panel"
    on:click={ () => open = !open }
  >
    War log
    {#if !open && $unseen}<span class="warlog-badge" aria-label={ `${ $unseen } new` }>{ $unseen }</span>{/if}
  </button>

  {#if open}
    <div class="panel warlog-panel" id="warlog-panel">
      <label class="warlog-filter">
        <input type="checkbox" checked={ $major_only } on:change={ e => warlog.setMajorOnly( e.target.checked ) }/>
        Major only
      </label>

      {#if $source === 'browser'}
        <p class="warlog-notice" role="status">
          Server log unavailable; showing changes seen by this browser.
        </p>
      {/if}

      {#if $warlog.length}
        <ul class="warlog-list">
          {#each $warlog as entry ( entry.id )}
            <li>
              <button
                type="button"
                class={ `warlog-entry ${ teamClass( entry.team ) }` }
                class:major={ entry.major }
                disabled={ !entry.item }
                on:click={ () => warlog.focus( entry ) }
              >
                {#if entry.item}
                  <img src={ icons.getIcon( entry.item, $settings.icons ) } alt="" width="20" height="20"/>
                {/if}
                <span class="warlog-text">
                  <span>{#if entry.teamFirst}<b>{ entry.team }</b>{/if}{ entry.teamFirst ? ` ${ entry.text }` : entry.text }</span>
                  {#if entry.place}<span class="warlog-place">{ entry.place }</span>{/if}
                </span>
                <time datetime={ new Date( entry.time ).toISOString() } title={ new Date( entry.time ).toLocaleString() }>
                  { ago( entry.time, now ) }
                </time>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="warlog-empty">
          {#if $source === 'loading'}
            Loading the war log…
          {:else if $major_only}
            No major changes yet. Victory towns, relic bases and rockets appear here.
          {:else if $source === 'server'}
            No changes recorded yet this war. Captures, new structures and scorched towns appear
            here.
          {:else}
            Watching for changes. Captures, new structures and scorched towns appear here while
            this page is open.
          {/if}
        </p>
      {/if}
    </div>
  {/if}

  <div class="visually-hidden" aria-live="polite">
    {#if announcement}{ announcement.team } { announcement.text } { announcement.place }{/if}
  </div>
</div>
