<script>

  /**
   * Line icon, drawn in the current text colour; decorative, so hidden from screen readers.
   * Styled by .icon in main.css.
   */

  /**
   * Which icon: search, map, list, legend, settings or shard.
   * @type {string}
   */
  export let name = '';

  /**
   * Width and height in pixels.
   * @type {number}
   */
  export let size = 18;

</script>

<svg class="icon" viewBox="0 0 24 24" width={ size } height={ size } aria-hidden="true" focusable="false">
  {#if name === 'search'}
    <circle cx="10.5" cy="10.5" r="6.5"/>
    <line x1="15.5" y1="15.5" x2="21" y2="21"/>
  {:else if name === 'map'}
    <!-- folded map -->
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/>
    <line x1="15" y1="6" x2="15" y2="21"/>
  {:else if name === 'list'}
    <line x1="9" y1="6" x2="20" y2="6"/>
    <line x1="9" y1="12" x2="20" y2="12"/>
    <line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4.5" cy="6" r="1"/>
    <circle cx="4.5" cy="12" r="1"/>
    <circle cx="4.5" cy="18" r="1"/>
  {:else if name === 'legend'}
    <!-- colour swatches with labels -->
    <rect x="3" y="4" width="6" height="6" rx="1"/>
    <rect x="3" y="14" width="6" height="6" rx="1"/>
    <line x1="13" y1="7" x2="21" y2="7"/>
    <line x1="13" y1="17" x2="21" y2="17"/>
  {:else if name === 'settings'}
    <!-- sliders -->
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="4" y1="18" x2="20" y2="18"/>
    <circle class="icon-knob" cx="9" cy="6" r="2.2"/>
    <circle class="icon-knob" cx="15" cy="12" r="2.2"/>
    <circle class="icon-knob" cx="7" cy="18" r="2.2"/>
  {:else if name === 'shard'}
    <!-- servers -->
    <rect x="3" y="4" width="18" height="7" rx="2"/>
    <rect x="3" y="13" width="18" height="7" rx="2"/>
    <line x1="7" y1="7.5" x2="7.01" y2="7.5"/>
    <line x1="7" y1="16.5" x2="7.01" y2="16.5"/>
  {/if}
</svg>
