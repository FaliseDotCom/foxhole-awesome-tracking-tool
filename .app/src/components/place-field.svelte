<script>

  /**
   * Place field with suggestions for places and structures (ARIA combobox pattern), over a
   * field of the search store (search.createField()): the map search at the top and every
   * place of the route planner. Styled by .search-field and .search-list in search.css.
   */

  import { search } from '@stores/search'
  import { icons } from '@stores/icons'
  import { settings } from '@stores/settings'
  import Icon from '@components/icon.svelte'

  /**
   * The field's state and methods, from search.createField().
   * @type {object}
   */
  export let field;

  /**
   * Prefix of the element ids of the list and its options, unique on the page.
   * @type {string}
   */
  export let id = 'search';

  /**
   * Accessible name of the field.
   * @type {string}
   */
  export let label = 'Search places and structures';

  /**
   * Placeholder text.
   * @type {string}
   */
  export let placeholder = 'Search the map…';

  /**
   * Icon before the text, for what the field is for; see icon.svelte.
   * @type {string}
   */
  export let icon = 'map';

  /**
   * Whether the field has a search button that chooses the first suggestion.
   * @type {boolean}
   */
  export let go = false;

  /**
   * Text, list and highlight of the field.
   * @type {import('svelte/store').Readable<*>}
   */
  const query = field.query,
        open = field.open,
        active = field.active,
        list = field.list;

  /**
   * The text input, for focusing it.
   * @type {HTMLInputElement|null}
   */
  let input = null;

  /**
   * Suggestions or recent choices shown in the list.
   * @type {object[]}
   */
  $: entries = $list.entries;

  /**
   * Whether the list shows.
   * @type {boolean}
   */
  $: expanded = $open && entries.length > 0;

  /**
   * Put the cursor in the field.
   *
   * @returns {void}
   */
  export const focus = () => input.focus();

  /**
   * Second line of a suggestion: kind, team and hex.
   *
   * @param {object} entry Search entry.
   * @returns {string} Description.
   */
  const describe = entry => [ search.kinds[ entry.kind ].label, entry.team, entry.kind === 'hex' ? '' : entry.hexTitle ]
    .filter( Boolean )
    .join( ' · ' );

  /**
   * Keys in the field: move through the list, choose, close and empty.
   *
   * @param {KeyboardEvent} e Key event.
   * @returns {void}
   */
  const onKeydown = e =>
  {
    switch ( e.key )
    {
      case 'ArrowDown':
        field.move( 1 );
        break;
      case 'ArrowUp':
        field.move( -1 );
        break;
      case 'Enter':
        field.chooseActive();
        break;
      case 'Escape':
        // first close the list, then empty the field and hand the keys back to the map
        if ( expanded ) field.setOpen( false );
        else
        {
          field.clear();
          input.blur();
        }
        break;
      default:
        return;
    }
    e.preventDefault();
    // Escape in a field is the field's, not the tab panel's
    e.stopPropagation();
  };

  /**
   * Choose on pointerdown, before the field's blur closes the list.
   *
   * @param {PointerEvent} e     Pointer event.
   * @param {object}       entry Search entry.
   * @returns {void}
   */
  const onChoose = ( e, entry ) =>
  {
    e.preventDefault();
    field.choose( entry );
  };

  /**
   * Remove a recent choice.
   *
   * @param {PointerEvent} e     Pointer event.
   * @param {object}       entry Search entry.
   * @returns {void}
   */
  const onForget = ( e, entry ) =>
  {
    e.preventDefault();
    e.stopPropagation();
    field.forget( entry );
  };

  /**
   * The search button: go to the highlighted or first suggestion, or start typing.
   *
   * @returns {void}
   */
  const onSearch = () =>
  {
    if ( !field.chooseActive() ) input.focus();
  };

  /**
   * Empty the field and keep typing.
   *
   * @returns {void}
   */
  const onClear = () =>
  {
    field.clear();
    input.focus();
  };

</script>

<div class="search-field" class:search-field-go={ go }>
  <span class="search-kind"><Icon name={ icon }/></span>
  <input
    bind:this={ input }
    type="text"
    role="combobox"
    { placeholder }
    aria-label={ label }
    aria-autocomplete="list"
    aria-expanded={ expanded }
    aria-controls={ `${ id }-list` }
    aria-activedescendant={ expanded && $active >= 0 ? `${ id }-option-${ $active }` : undefined }
    autocomplete="off"
    spellcheck="false"
    value={ $query }
    on:input={ e => field.setQuery( e.target.value ) }
    on:focus={ () => field.setOpen( true ) }
    on:blur={ () => field.setOpen( false ) }
    on:keydown={ onKeydown }
  />
  {#if $query}
    <button type="button" class="search-clear" aria-label={ `Clear ${ label.toLowerCase() }` } title="Clear" on:click={ onClear }>×</button>
  {/if}
  {#if go}
    <button type="button" class="search-go" aria-label="Search" on:click={ onSearch }>
      <Icon name="search"/>
    </button>
  {/if}
</div>

{#if expanded}
  <ul class="search-list" id={ `${ id }-list` } role="listbox" aria-label={ $list.heading || 'Suggestions' }>
    {#if $list.heading}
      <li class="search-heading" role="presentation">{ $list.heading }</li>
    {/if}
    {#each entries as entry, index ( search.entryId( entry ) )}
      <li
        id={ `${ id }-option-${ index }` }
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
