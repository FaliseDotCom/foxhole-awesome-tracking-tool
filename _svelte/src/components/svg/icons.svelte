<script>

  import { icons } from '@stores/icons.js'

  /**
    Use <use href="#nameOfIcon" x="20" y="20" /> in your svg instead of the icon itself
  */

  const els = [];
  for( const [ id, name ] of Object.entries( icons.list ) )
  {
    els.push( `<image id="${id}" href="${ icons.getIcon( id ) }" title="${ icons.getName( id ) }" />` );
    if ( icons.isConquerable( id) )
    {
      els.push( `<image id="${id}-warden" href="${ icons.getIcon( id, 'warden' ) }" title="${ icons.getName( id ) }" />` );
      els.push( `<image id="${id}-warden" href="${ icons.getIcon( id, 'colonial' ) }" title="${ icons.getName( id ) }" />` );
    }
  }

</script>
<defs>{@html els.join( '' ) }</defs>