<script>

  /**
   * Viewer settings, remembered in the browser: icon brightness, hex shading, how the map looks
   * (team colours, region colour strength, icon size, hex names) and rocket sounds
   */

  import { config } from '@stores/config'
  import { settings } from '@stores/settings'

  // a style group shows only when there is something to choose
  const groups = [
    { key: 'icons', title: 'Icon brightness' },
    { key: 'maps', title: 'Map style' },
    { key: 'shading', title: 'Hex shading' },
    { key: 'palette', title: 'Team colours' },
    { key: 'side', title: 'Tabs' }
  ].filter( group => config.styles[ group.key ].length > 1 );

  // option labels where the style name alone does not say enough
  const labels = {
    none: 'none',
    fighting: 'fighting: casualties in the last hour',
    changes: 'changes: the last 6 hours',
    'colour-blind': 'colour-blind: blue and orange',
    right: 'on the right, logo on the left',
    left: 'on the left, logo on the right'
  };

  // sliders, in the order shown
  const sliders = [
    { key: 'regionStrength', title: 'Region colours' },
    { key: 'iconScale', title: 'Icon size' }
  ];

  const times = value => `${ Math.round( value * 100 ) }%`;

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
        { labels[ style ] || style }
      </label>
    {/each}
  </fieldset>
{/each}

<fieldset class="settings-group">
  <legend>Map look</legend>
  {#each sliders as { key, title } ( key )}
    {@const range = settings.ranges[ key ]}
    <label class="settings-slider">
      <span>{ title } <output>{ times( $settings[ key ] ) }</output></span>
      <input
        type="range"
        min={ range.min }
        max={ range.max }
        step={ range.step }
        value={ $settings[ key ] }
        on:input={ e => settings.set( key, Number( e.target.value ) ) }
      />
    </label>
  {/each}
  <label>
    <input type="checkbox" checked={ $settings.names } on:change={ e => settings.set( 'names', e.target.checked ) }/>
    Hex names
  </label>
</fieldset>

<fieldset class="settings-group">
  <legend>Rockets</legend>
  <label>
    <input type="checkbox" checked={ $settings.sound } on:change={ e => settings.set( 'sound', e.target.checked ) }/>
    Alarm and impact sounds
  </label>
</fieldset>

<fieldset class="settings-group">
  <legend>Privacy</legend>
  <p class="legend-note">
    F.A.T.T. counts visits, opened tabs, searches that found something, and changed settings on
    its own statistics server, without cookies and without storing your IP address. When your
    browser sends Do Not Track or Global Privacy Control, nothing is counted.
  </p>
</fieldset>
