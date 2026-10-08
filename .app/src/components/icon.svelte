<script>

  /**
   * Line icon, drawn in the current text colour; decorative, so hidden from screen readers.
   * Styled by .icon in main.css.
   */

  /**
   * Which icon: search, map, list, legend, settings, shard, target, clock, chart, up, down, left,
   * right, plus, minus or fit.
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
  {:else if name === 'target'}
    <!-- crosshair: go to the place -->
    <circle cx="12" cy="12" r="7"/>
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
  {:else if name === 'up'}
    <polyline points="6 15 12 9 18 15"/>
  {:else if name === 'down'}
    <polyline points="6 9 12 15 18 9"/>
  {:else if name === 'left'}
    <polyline points="15 6 9 12 15 18"/>
  {:else if name === 'right'}
    <polyline points="9 6 15 12 9 18"/>
  {:else if name === 'plus'}
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  {:else if name === 'minus'}
    <line x1="5" y1="12" x2="19" y2="12"/>
  {:else if name === 'fit'}
    <!-- four corners: the whole map -->
    <polyline points="4 9 4 4 9 4"/>
    <polyline points="15 4 20 4 20 9"/>
    <polyline points="20 15 20 20 15 20"/>
    <polyline points="9 20 4 20 4 15"/>
  {:else if name === 'chart'}
    <!-- a line going up and down over a base line -->
    <polyline points="3 17 9 11 13 14 21 6"/>
    <line x1="3" y1="21" x2="21" y2="21"/>
  {:else if name === 'clock'}
    <!-- the map at that moment -->
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15.5 14"/>
  {:else if name === 'shard'}
    <!-- servers -->
    <rect x="3" y="4" width="18" height="7" rx="2"/>
    <rect x="3" y="13" width="18" height="7" rx="2"/>
    <line x1="7" y1="7.5" x2="7.01" y2="7.5"/>
    <line x1="7" y1="16.5" x2="7.01" y2="16.5"/>
  {/if}
</svg>
