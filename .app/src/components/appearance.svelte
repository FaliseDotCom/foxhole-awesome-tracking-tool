<script>

  /**
   * Applies the map look settings to the page, as classes and custom properties on the root
   * element that the stylesheets use: the colour-blind team colours (vars.css), hidden hex names
   * (map.css), the icon size and the region colour strength (map.css), and the tabs on the left
   * (panels.css, search.css, logo.svelte). Renders nothing.
   */

  import { settings } from '@stores/settings'

  $: if ( typeof document !== 'undefined' )
  {
    const root = document.documentElement;
    root.classList.toggle( 'palette-colour-blind', $settings.palette === 'colour-blind' );
    root.classList.toggle( 'hide-hex-names', !$settings.names );
    root.classList.toggle( 'tabs-left', $settings.side === 'left' );
    root.style.setProperty( '--icon-scale', String( $settings.iconScale ) );
    root.style.setProperty( '--region-strength', String( $settings.regionStrength ) );
  }

</script>
