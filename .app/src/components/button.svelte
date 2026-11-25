<script>

  /**
   * Button with an icon and a label, in the variant of its role: main for the main or adding
   * action, light for secondary actions, danger for destructive ones. An icon-only button keeps
   * its label as accessible name and tooltip. Styled by .button in panels.css; other attributes
   * (data-track-…) are passed on to the button.
   */

  import Icon from '@components/icon.svelte'

  /**
   * Icon, see icon.svelte.
   * @type {string}
   */
  export let icon;

  /**
   * What the button does, in words.
   * @type {string}
   */
  export let label;

  /**
   * Role of the button: main, light or danger.
   * @type {string}
   */
  export let variant = 'light';

  /**
   * Whether only the icon shows; the label is then the accessible name and the tooltip.
   * @type {boolean}
   */
  export let iconOnly = false;

  /**
   * Pressed state of a toggle button, undefined for an ordinary button.
   * @type {boolean|undefined}
   */
  export let pressed = undefined;

  /**
   * Whether the button is disabled.
   * @type {boolean}
   */
  export let disabled = false;

</script>

<button
  type="button"
  class={ `button button-${ variant }` }
  class:button-icon={ iconOnly }
  aria-label={ iconOnly ? label : undefined }
  title={ iconOnly ? label : undefined }
  aria-pressed={ pressed }
  { disabled }
  { ...$$restProps }
  on:click
>
  <Icon name={ icon } size={ 16 }/>
  {#if !iconOnly}<span>{ label }</span>{/if}
</button>
