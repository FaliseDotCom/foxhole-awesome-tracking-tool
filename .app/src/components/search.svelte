<script>

  /**
   * Search field with suggestions for places and structures (ARIA combobox pattern)
   */

  import { search } from '@stores/search'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import Icon from '@components/icon.svelte'

  const query = search.query,
        open = search.open,
        active = search.active,
        list = search.list;

  let input = null;

  $: entries = $list.entries;
  $: expanded = $open && entries.length > 0;

  /**
   * Second line of a suggestion: kind, team and hex.
   *
   * @param {object} entry Search entry.
   * @returns {string} Description.
   */
  const describe = entry => [ search.kinds[ entry.kind ].label, entry.team, entry.kind === 'hex' ? '' : entry.hexTitle ]
    .filter( Boolean )
    .join( ' · ' );

  const onKeydown = e =>
  {
    switch ( e.key )
    {
      case 'ArrowDown':
        search.move( 1 );
        break;
      case 'ArrowUp':
        search.move( -1 );
        break;
      case 'Enter':
        search.chooseActive();
        break;
      case 'Escape':
        // first close the list, then empty the field and hand the keys back to the map
        if ( expanded ) search.setOpen( false );
        else
        {
          search.clear();
          input.blur();
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  // "/" anywhere on the page jumps to the search field
  const onWindowKeydown = e =>
  {
    if ( e.key !== '/' || e.target.closest( 'input, textarea, select, [contenteditable]' ) ) return;
    e.preventDefault();
    input.focus();
  }

  // choose on pointerdown, before the field's blur closes the list
  const onChoose = ( e, entry ) =>
  {
    e.preventDefault();
    search.choose( entry );
  }

  const onForget = ( e, entry ) =>
  {
    e.preventDefault();
    e.stopPropagation();
    search.forget( entry );
  }

  // the search button: go to the highlighted or first suggestion, or start typing
  const onSearch = () =>
  {
    if ( !search.chooseActive() ) input.focus();
  }

  const onClear = () =>
  {
    search.clear();
    input.focus();
  }

</script>

<svelte:window on:keydown={ onWindowKeydown }/>

<div class="search" data-track="Search">
  <div class="search-field">
    <span class="search-kind"><Icon name="map"/></span>
    <input
      bind:this={ input }
      type="text"
      role="combobox"
      placeholder="Search the map…"
      aria-label="Search places and structures"
      aria-autocomplete="list"
      aria-expanded={ expanded }
      aria-controls="search-list"
      aria-activedescendant={ expanded && $active >= 0 ? `search-option-${ $active }` : undefined }
      autocomplete="off"
      spellcheck="false"
      value={ $query }
      on:input={ e => search.setQuery( e.target.value ) }
      on:focus={ () => search.setOpen( true ) }
      on:blur={ () => search.setOpen( false ) }
      on:keydown={ onKeydown }
    />
    {#if $query}
      <button type="button" class="search-clear" aria-label="Clear search" on:click={ onClear }>×</button>
    {/if}
    <button type="button" class="search-go" aria-label="Search" on:click={ onSearch }>
      <Icon name="search"/>
    </button>
  </div>

  {#if expanded}
    <ul class="search-list" id="search-list" role="listbox" aria-label={ $list.heading || 'Suggestions' }>
      {#if $list.heading}
        <li class="search-heading" role="presentation">{ $list.heading }</li>
      {/if}
      {#each entries as entry, index ( search.entryId( entry ) )}
        <li
          id={ `search-option-${ index }` }
          class="search-option"
          class:active={ index === $active }
          role="option"
          aria-selected={ index === $active }
          on:pointerdown={ e => onChoose( e, entry ) }
        >
          {#if entry.item}
            <img src={ icons.getIcon( entry.item, $settings.icons ) } alt="" width="20" height="20"/>
          {/if}
          <span class="search-text">
            <span class="search-name">{ entry.name }</span>
            <span class="search-meta">{ describe( entry ) }</span>
          </span>
          {#if $list.heading}
            <button
              type="button"
              class="search-forget"
              aria-label={ `Remove ${ entry.name } from recent searches` }
              on:pointerdown={ e => onForget( e, entry ) }
            >×</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
