<script>

  /**
   * Route tab: the team, the places of the route (start, stops, destination) chosen with the
   * search or on the map, the vehicle class, the result with its distance and fuel estimate,
   * and the route mode and options. The route itself is drawn by components/map/route.svelte.
   */

  import { onMount, onDestroy } from 'svelte'
  import { route } from '@stores/route'
  import PlaceField from '@components/place-field.svelte'
  import ChoiceRow from '@components/choice-row.svelte'
  import Button from '@components/button.svelte'
  import InfoTip from '@components/info-tip.svelte'

  /**
   * Preferences, places, the point being picked on the map, the road network's loading state,
   * and the planned route.
   * @type {import('svelte/store').Readable<*>}
   */
  const prefs = route.prefs,
        points = route.points,
        picking = route.picking,
        status = route.status,
        result = route.result;

  onMount( () => route.load() );

  // a closed panel no longer picks on the map
  onDestroy( () => route.stopPicking() );

  /**
   * The options that apply: as the route changed them for its places, or as chosen.
   * @type {Record<string, boolean>}
   */
  $: applied = $result ? $result.options : $prefs;

  /**
   * Notes on options the route changed by itself, by option key.
   * @type {Record<string, string>}
   */
  $: notes = $result ? $result.notes : {};

  /**
   * Role of the point being picked on the map, '' when none is.
   * @type {string}
   */
  $: pickingRole = ( $points.find( point => point.id === $picking ) || { role: '' } ).role;

  /**
   * The chosen vehicle class with its fuel figures.
   * @type {object}
   */
  $: vehicle = route.vehicles.find( option => option.key === $prefs.vehicle );

  /**
   * An element at the top of the panel, for measuring the panel.
   * @type {HTMLElement|null}
   */
  let top = null;

  // a complete route is fitted on screen once
  $: if ( $result && $result.ok ) route.fitNew( covered() );

  /**
   * Screen width the open panel covers on the left or the right, so a route is fitted beside
   * it rather than under it.
   *
   * @returns {{ left: number, right: number }} Covered widths in CSS pixels.
   */
  const covered = () =>
  {
    const panel = top ? top.closest( '.tab-panel' ) : null;
    if ( !panel ) return { left: 0, right: 0 };
    const box = panel.getBoundingClientRect();
    return box.left > window.innerWidth / 2
      ? { left: 0, right: window.innerWidth - box.left }
      : { left: box.right, right: 0 };
  };

  /**
   * Distance in km with one decimal.
   *
   * @param {number} value Distance in km.
   * @returns {string} Text, such as "12.3 km".
   */
  const km = value => `${ value.toFixed( 1 ) } km`;

  /**
   * Litres per km with one decimal.
   *
   * @param {number} value Litres per km.
   * @returns {string} Text, such as "4.3 L/km".
   */
  const perKm = value => `${ value.toFixed( 1 ) } L/km`;

  /**
   * Escape stops picking on the map, before the tabs close the panel.
   *
   * @param {KeyboardEvent} e Key event.
   * @returns {void}
   */
  const onKeydown = e =>
  {
    if ( e.key !== 'Escape' || !$picking ) return;
    e.preventDefault();
    route.stopPicking();
  };

</script>

<svelte:window on:keydown|capture={ onKeydown }/>

<div class="legend-section" bind:this={ top }>
  <h3>Your team</h3>
  <ChoiceRow
    options={ route.teams }
    value={ $prefs.team }
    label="Your team"
    on:choose={ e => route.setPref( 'team', e.detail ) }
  />
  {#if !$prefs.team}
    <p class="legend-note">
      Choose your team to plan a route: the planner keeps to your own territory and stays out of
      the enemy's. Remembered in this browser.
    </p>
  {/if}
</div>

{#if $prefs.team}
  <div class="legend-section">
    <h3>Route</h3>
    <ol class="route-points">
      {#each $points as point, index ( point.id )}
        <li class="route-point">
          <span class="route-label" aria-hidden="true">{ point.label }</span>
          <div class="route-field">
            <PlaceField
              field={ point.field }
              id={ `route-${ point.id }` }
              label={ point.role }
              placeholder={ `${ point.role }…` }
              icon="route"
            />
          </div>
          <Button
            icon="target"
            label={ `Pick the ${ point.role.toLowerCase() } on the map` }
            iconOnly
            pressed={ $picking === point.id }
            on:click={ () => route.togglePicking( point.id ) }
          />
          <Button icon="up" label={ `Move the ${ point.role.toLowerCase() } up` } iconOnly disabled={ index === 0 } on:click={ () => route.move( point.id, -1 ) }/>
          <Button icon="down" label={ `Move the ${ point.role.toLowerCase() } down` } iconOnly disabled={ index === $points.length - 1 } on:click={ () => route.move( point.id, 1 ) }/>
          {#if $points.length > 2}
            <Button icon="close" label={ `Remove ${ point.role.toLowerCase() }` } iconOnly variant="danger" on:click={ () => route.remove( point.id ) }/>
          {/if}
        </li>
      {/each}
    </ol>
    {#if pickingRole}
      <p class="legend-note route-picking" role="status">Click the map to choose the { pickingRole.toLowerCase() }. Escape stops.</p>
    {/if}
    <div class="route-actions">
      <Button icon="plus" label="Add stop" variant="main" on:click={ () => route.addStop() }/>
      <Button icon="trash" label="Clear route" variant="danger" on:click={ () => route.clear() }/>
    </div>
  </div>

  <div class="legend-section">
    <h3>Vehicle</h3>
    <ChoiceRow
      options={ route.vehicles }
      value={ $prefs.vehicle }
      label="Vehicle speed class"
      on:choose={ e => route.setPref( 'vehicle', e.detail ) }
    />
    <p class="legend-note">{ vehicle.label[ 0 ].toUpperCase() }{ vehicle.label.slice( 1 ) }.</p>
  </div>

  <div class="legend-section route-result" aria-live="polite">
    {#if $status === 'loading'}
      <p class="legend-note">Loading the road network…</p>
    {:else if $status === 'error'}
      <p class="route-problem">The road network could not be loaded. Try again later.</p>
    {:else if !$result}
      <p class="legend-note">Choose a start and a destination: search for a place, or pick one on the map.</p>
    {:else if !$result.ok}
      <p class="route-problem"><strong>No route.</strong> { $result.message }</p>
    {:else}
      <!-- the distance and the fuel side by side, each with an (i) that says how far to trust it -->
      <div class="route-figures">
        <div class="route-figure">
          <span class="stats-big route-km">{ km( $result.km ) }</span>
          <span class="route-figure-name">
            distance
            <InfoTip label="About the road network">
              Roads are traced from the map images and may miss a road or a bridge; gates, walls and
              destroyed bridges are not known.
            </InfoTip>
          </span>
        </div>
        <div class="route-figure">
          <span class="stats-big route-fuel">{ $result.fuel.litres } L</span>
          <span class="route-figure-name">
            fuel, about
            <InfoTip label="About the fuel estimate">
              Fuel is estimated on the high side: for the thirstiest vehicle of the class, fully loaded
              ({ perKm( vehicle.figures.road ) } on the road, { perKm( vehicle.figures.offroad ) } off it),
              plus { Math.round( ( route.margin - 1 ) * 100 ) } % for bends, hills, junctions and weather.
              Figures from the Foxhole Wiki for update { route.gameVersion }.
            </InfoTip>
          </span>
        </div>
      </div>
      {#if $result.legs.length > 1}
        <ul class="route-legs">
          {#each $result.legs as leg, index ( index )}
            <li><span>{ leg.from.label } → { leg.to.label }</span><span>{ km( leg.km ) }</span></li>
          {/each}
        </ul>
      {/if}
      <!-- the colours of the line on the map -->
      <ul class="route-classes" aria-label="Territory along the route">
        {#each $result.byClass as part ( part.cls )}
          <li><span class={ `route-swatch route-${ part.cls }` }></span>{ km( part.km ) } { part.name }</li>
        {/each}
      </ul>
      {#if $result.offroad >= .05}
        <p class="legend-note">And { km( $result.offroad ) } off the road to reach it, dashed on the map.</p>
      {/if}
      {#if $result.fuel.overTank}
        <p class="route-problem">More than a full tank ({ $result.fuel.tank } L) of the smallest tank in this class: refuel on the way.</p>
      {/if}
      <Button icon="fit" label="Show the route" on:click={ () => route.fit( covered() ) }/>
    {/if}
  </div>

  <div class="legend-section">
    <h3 class="settings-row">
      Prefer
      <InfoTip label="About shortest and safest">
        Shortest takes the shortest road the options allow. Safest weighs every km by its
        territory: friendly ground counts once, neutral twice, contested four times and enemy
        territory eleven times, so it takes a detour to keep to your own ground.
      </InfoTip>
    </h3>
    <ChoiceRow
      options={ route.modes }
      value={ $prefs.mode }
      label="Kind of route"
      on:choose={ e => route.setPref( 'mode', e.detail ) }
    />
  </div>

  <fieldset class="settings-group">
    <legend>Options</legend>
    {#each route.options as option ( option.key )}
      <label>
        <input
          type="checkbox"
          checked={ applied[ option.key ] }
          disabled={ Boolean( notes[ option.key ] ) }
          on:change={ e => route.setPref( option.key, e.target.checked ) }
        />
        { option.title }
      </label>
      {#if notes[ option.key ]}
        <p class="legend-note route-auto">{ notes[ option.key ] }</p>
      {/if}
    {/each}
    <p class="legend-note">Contested: hexes with casualties in the last hour.</p>
  </fieldset>
{/if}
