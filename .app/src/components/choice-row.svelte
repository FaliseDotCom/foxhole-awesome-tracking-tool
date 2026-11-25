<script>

  /**
   * A row of choices of which one is chosen (segmented buttons), such as the time span of the
   * stats charts or the team in the route planner. Dispatches `choose` with the option's key;
   * the store keeps the choice. Styled by .choice-row in panels.css.
   */

  import { createEventDispatcher } from 'svelte';

  /**
   * @typedef {Object} Option
   * @property {string} key Value of the option.
   * @property {string} title Text on the button.
   * @property {string} [hint] Tooltip, what choosing it does.
   */

  /**
   * The options, in the order shown.
   * @type {Option[]}
   */
  export let options = [];

  /**
   * Key of the chosen option, '' for none.
   * @type {string}
   */
  export let value = '';

  /**
   * Accessible name of the group.
   * @type {string}
   */
  export let label = '';

  const dispatch = createEventDispatcher();

</script>

<div class="choice-row" role="group" aria-label={ label }>
  {#each options as option ( option.key )}
    <button
      type="button"
      class="choice"
      aria-pressed={ value === option.key }
      title={ option.hint }
      on:click={ () => dispatch( 'choose', option.key ) }
    >{ option.title }</button>
  {/each}
</div>
