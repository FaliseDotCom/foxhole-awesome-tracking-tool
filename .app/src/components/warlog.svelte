<script>

  /**
   * War log tab: changes in the war, newest first; click an entry to go there. Shown by
   * tabs.svelte, which also keeps the unseen count and the screen reader announcements
   */

  import { onMount, onDestroy } from 'svelte';
  import { warlog } from '@stores/warlog'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import Icon from '@components/icon.svelte'

  const major_only = warlog.majorOnly,
        query = warlog.query,
        source = warlog.source,
        checked = warlog.checked,
        recorder = warlog.recorder;

  // a clock for "2 min ago" and "checked 5s ago"
  let now = Date.now(),
      clock = 0;

  onMount( () => clock = setInterval( () => now = Date.now(), 5000 ) );
  onDestroy( () => clearInterval( clock ) );

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

  /**
   * How long ago something was checked, to the second while recent.
   *
   * @param {number} time Time in ms.
   * @param {number} current Current time in ms.
   * @returns {string} "5s ago", or as ago() from a minute on.
   */
  const agoShort = ( time, current ) =>
  {
    const seconds = Math.max( 0, Math.round( ( current - time ) / 1000 ) );
    return seconds < 60 ? `${ seconds }s ago` : ago( time, current );
  };

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

</script>

  <div class="warlog-search">
    <span class="warlog-search-kind"><Icon name="list"/></span>
    <input
      type="text"
      placeholder="Search the log…"
      aria-label="Search the war log"
      autocomplete="off"
      spellcheck="false"
      value={ $query }
      on:input={ e => warlog.setQuery( e.target.value ) }
    />
    <span class="warlog-search-go"><Icon name="search"/></span>
  </div>

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
