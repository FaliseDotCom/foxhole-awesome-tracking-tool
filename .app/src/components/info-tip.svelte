<script>

  /**
   * An (i) button with a longer explanation in a bubble below it: shown while hovered or
   * focused, and kept open by a click or tap (for touch screens). The text is the slot. Styled
   * by .info-tip in panels.css.
   */

  import Icon from '@components/icon.svelte'

  /**
   * Accessible name and tooltip of the button.
   * @type {string}
   */
  export let label = 'More information';

  /**
   * Whether the bubble is kept open by a click or tap.
   * @type {boolean}
   */
  let open = false;

  /**
   * Id of the bubble, which describes the button for screen readers.
   * @type {string}
   */
  const id = `info-tip-${ Math.random().toString( 36 ).slice( 2 ) }`;

</script>

<span class="info-tip" class:open>
  <button
    type="button"
    class="info-tip-button"
    aria-label={ label }
    title={ label }
    aria-expanded={ open }
    aria-describedby={ id }
    on:click={ () => open = !open }
    on:blur={ () => open = false }
  >
    <Icon name="info" size={ 16 }/>
  </button>
  <span class="info-tip-text" role="tooltip" { id }><slot/></span>
</span>
