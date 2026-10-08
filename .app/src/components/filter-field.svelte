<script>

  /**
   * Search field that filters a list in a tab panel as you type: an icon for what it searches
   * before it, a search icon after. Dispatches `input` with the text; the store does the
   * filtering. Styled by .filter-field in panels.css.
   */

  import { createEventDispatcher } from 'svelte';
  import Icon from '@components/icon.svelte'

  /**
   * Icon for what the field searches, see icon.svelte.
   * @type {string}
   */
  export let icon = 'list';

  /**
   * Accessible name of the field.
   * @type {string}
   */
  export let label = '';

  /**
   * Placeholder text.
   * @type {string}
   */
  export let placeholder = '';

  /**
   * Current text, from the store.
   * @type {string}
   */
  export let value = '';

  const dispatch = createEventDispatcher();

</script>

<div class="filter-field">
  <span class="filter-field-kind"><Icon name={ icon }/></span>
  <input
    type="text"
    { placeholder }
    aria-label={ label }
    autocomplete="off"
    spellcheck="false"
    { value }
    on:input={ e => dispatch( 'input', e.target.value ) }
  />
  <span class="filter-field-go"><Icon name="search"/></span>
</div>
