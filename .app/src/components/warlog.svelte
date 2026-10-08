<script>

  /**
   * War log tab: changes in the war, newest first; click an entry to go there. Shown by
   * tabs.svelte, which also keeps the unseen count and the screen reader announcements
   */

  import { onMount, onDestroy } from 'svelte';
  import { warlog } from '@stores/warlog'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import FilterField from '@components/filter-field.svelte'
  import Icon from '@components/icon.svelte'
  import { ago, agoShort } from '@lib/time'

  const major_only = warlog.majorOnly,
        query = warlog.query,
        paging = warlog.paging,
        history_since = warlog.historySince,
        source = warlog.source,
        checked = warlog.checked,
        recorder = warlog.recorder;

  // a clock for "2 min ago" and "checked 5s ago"
  let now = Date.now(),
      clock = 0;

  onMount( () => clock = setInterval( () => now = Date.now(), 5000 ) );
  onDestroy( () => clearInterval( clock ) );

  /**
   * Who keeps the log up to date, for the status line's tooltip: shows whether the cron job runs.
   *
   * @param {{ by: string, cronAt: number }} info Recorder info from the server.
   * @param {string} from Current source: server or browser.
   * @param {number} current Current time in ms.
   * @returns {string} Tooltip text.
   */
  const recorderText = ( info, from, current ) =>
  {
    if ( from === 'browser' ) return 'The server log is not answering; this browser compares the map itself.';
    const last = info.by === 'cron' ? 'the cron job' : "a visitor's map update";
    const cron = info.cronAt ? `The cron job last ran ${ agoShort( info.cronAt, current ) }.` : 'The cron job has not run yet.';
    return `Last checked by ${ last }. ${ cron }`;
  };

  const teamClass = team => team ? `team-${ team.toLowerCase() }` : 'team-none';

  /**
   * Whether the map can be shown as it was at an entry: a structure entry from the server log,
   * after history recording started.
   *
   * @param {object} entry Log entry.
   * @param {number} since Start of the history, in ms; 0 when there is none.
   * @returns {boolean} True when the moment can be shown.
   */
  const hasMoment = ( entry, since ) => Boolean( entry.item ) && entry.source === 'server' && since > 0 && entry.time >= since;

  /**
   * Svelte action: call back when the element scrolls into view, to load older entries.
   *
   * @param {HTMLElement} node Element at the end of the list.
   * @param {function(): void} callback Called each time it comes into view.
   * @returns {{ destroy: function(): void }} Action handle.
   */
  const whenVisible = ( node, callback ) =>
  {
    const observer = new IntersectionObserver( entries =>
    {
      if ( entries.some( entry => entry.isIntersecting ) ) callback();
    } );
    observer.observe( node );
    return { destroy: () => observer.disconnect() };
  };

</script>

  <FilterField
    icon="list"
    label="Search the war log"
    placeholder="Search the log…"
    value={ $query }
    on:input={ e => warlog.setQuery( e.detail ) }
  />

  <label class="warlog-filter">
    <input type="checkbox" checked={ $major_only } on:change={ e => warlog.setMajorOnly( e.target.checked ) }/>
    Major updates only
  </label>

  <!-- shows the log is working even when nothing has changed for a while -->
  {#if $checked}
    <p class="warlog-status" class:fallback={ $source === 'browser' } title={ recorderText( $recorder, $source, now ) }>
      <span class="warlog-live">{ $source === 'browser' ? 'This browser' : 'Live' }</span>
      · checked { agoShort( $checked, now ) }
      {#if $warlog.length}· last change { ago( $warlog[ 0 ].time, now ) }{/if}
    </p>
  {/if}

  {#if $source === 'browser'}
    <p class="warlog-notice" role="status">
      Server log unavailable; showing changes seen by this browser.
    </p>
  {/if}

  {#if $warlog.length}
    <ul class="warlog-list">
      {#each $warlog as entry ( entry.id )}
        <li class="warlog-row">
          <button
            type="button"
            class={ `warlog-entry ${ teamClass( entry.team ) }` }
            class:major={ entry.major }
            disabled={ !entry.item }
            title={ entry.item ? 'Show where on the map' : undefined }
            on:click={ () => warlog.highlight( entry ) }
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
          {#if entry.item}
            <span class="warlog-actions">
              <button type="button" class="warlog-action" title="Go there" aria-label="Go there" on:click={ () => warlog.focus( entry ) }>
                <Icon name="target" size={ 16 }/>
              </button>
              <button
                type="button"
                class="warlog-action"
                disabled={ !hasMoment( entry, $history_since ) }
                title={ hasMoment( entry, $history_since ) ? 'Show the map at this moment' : 'The map history starts later than this' }
                aria-label="Show the map at this moment"
                data-track-skip
                on:click={ () => warlog.showAt( entry ) }
              >
                <Icon name="clock" size={ 16 }/>
              </button>
            </span>
          {/if}
        </li>
      {/each}
      {#if $paging.next && $source === 'server'}
        <li class="warlog-more" use:whenVisible={ () => warlog.loadOlder() }>
          { $paging.loading ? 'Loading older entries…' : 'Older entries' }
        </li>
      {/if}
    </ul>
  {:else}
    <p class="warlog-empty">
      {#if $query.trim()}
        Nothing in the log matches “{ $query.trim() }”.
      {:else if $source === 'loading'}
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
