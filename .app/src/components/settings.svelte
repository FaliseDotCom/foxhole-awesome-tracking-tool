<script>

  /**
   * Viewer settings: icon brightness, map style and rocket sounds, remembered in the browser
   */

  import { config } from '@stores/config'
  import { settings } from '@stores/settings'

  // a style group shows only when there is something to choose
  const groups = [
    { key: 'icons', title: 'Icon brightness' },
    { key: 'maps', title: 'Map style' }
  ].filter( group => config.styles[ group.key ].length > 1 );

</script>

{#each groups as { key, title } ( key )}
  <fieldset class="settings-group">
    <legend>{ title }</legend>
    {#each config.styles[ key ] as style ( style )}
      <label>
        <input
          type="radio"
          name={ `setting-${ key }` }
          value={ style }
          checked={ $settings[ key ] === style }
          on:change={ () => settings.set( key, style ) }
        />
        { style }
      </label>
    {/each}
  </fieldset>
{/each}

<fieldset class="settings-group">
  <legend>Rockets</legend>
  <label>
    <input type="checkbox" checked={ $settings.sound } on:change={ e => settings.set( 'sound', e.target.checked ) }/>
    Alarm and impact sounds
  </label>
</fieldset>
