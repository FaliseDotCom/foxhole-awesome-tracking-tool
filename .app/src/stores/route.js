import { writable, derived, get } from 'svelte/store';
import { grid } from './grid';
import { search } from './search';
import { territory } from './territory';
import { roads } from './roads';
import { view } from './view';
import { prepareGraph, planRoute, buildTerritory, toKm, DEFAULT_OPTIONS, MODES, CLASSES, MAX_SNAP, METRES_PER_PIXEL } from '@lib/routing';
import { VEHICLE_CLASSES, estimateFuel, classFigures, SAFETY_MARGIN, GAME_VERSION } from '@lib/vehicles';

/**
 * Route planner: the team, the places of the route (start, stops, destination), the route
 * options and the vehicle class, and the planned route over the road network with its
 * distance and fuel estimate. The routing itself is lib/routing.js. See
 * .docs/plans/2026-11-25-route-planner.md.
 */

/**
 * localStorage key of the route preferences.
 * @type {string}
 */
const storage_key = 'fatt-route';

/**
 * Zoom at which a place chosen for the route is shown, when there is no route to fit yet.
 * @type {number}
 */
const place_scale = 1;

/**
 * Smallest box shown around a route, in map pixels, so a short route is not zoomed in too far.
 * @type {number}
 */
const min_box = 400;

/**
 * Teams to choose from.
 * @type {{ key: string, title: string }[]}
 */
const teams = [
  { key: 'W', title: 'Wardens' },
  { key: 'C', title: 'Colonials' }
];

/**
 * Route modes as choices.
 * @type {{ key: string, title: string, hint: string }[]}
 */
const modes = [
  { key: 'shortest', title: 'Shortest', hint: 'The shortest road' },
  { key: 'safest', title: 'Safest', hint: 'A longer road when it keeps to friendly ground' }
];

/**
 * Route options as shown: the switch's text, and the territory it is about in words.
 * @type {{ key: string, title: string, territory: string }[]}
 */
const options = [
  { key: 'contested', title: 'Through contested territory', territory: 'contested territory' },
  { key: 'enemy', title: 'Through enemy territory', territory: 'enemy territory' },
  { key: 'avoidNeutral', title: 'Avoid neutral regions', territory: 'a neutral region' },
  { key: 'avoidScorched', title: 'Avoid scorched regions', territory: 'a scorched region' }
];

/**
 * Territory classes in words, for the route summary.
 * @type {Record<string, string>}
 */
const class_names = { friendly: 'friendly', neutral: 'neutral', contested: 'contested', enemy: 'enemy' };

/**
 * Preferences and their defaults, remembered in the browser: the team ('' until chosen), the
 * route mode, the vehicle class, and the options as chosen.
 * @type {{ team: string, mode: string, vehicle: string, enemy: boolean, contested: boolean, avoidNeutral: boolean, avoidScorched: boolean }}
 */
const defaults = { team: '', mode: 'safest', vehicle: VEHICLE_CLASSES[ 0 ].key, ...DEFAULT_OPTIONS };

/**
 * Whether a value is valid for a preference.
 *
 * @param {string} key   Preference name.
 * @param {*}      value Value to check.
 * @returns {boolean} True when valid.
 */
const isValid = ( key, value ) =>
{
  if ( key === 'team' ) return value === '' || teams.some( team => team.key === value );
  if ( key === 'mode' ) return MODES.includes( value );
  if ( key === 'vehicle' ) return VEHICLE_CLASSES.some( vehicle => vehicle.key === value );
  return key in DEFAULT_OPTIONS && typeof value === 'boolean';
};

/**
 * Read the saved preferences, keeping only valid values.
 *
 * @returns {typeof defaults} Saved preferences over the defaults.
 */
const readPrefs = () =>
{
  try
  {
    const saved = JSON.parse( window.localStorage.getItem( storage_key ) ) || {};
    return Object.fromEntries( Object.entries( defaults ).map( ( [ key, value ] ) => [ key, isValid( key, saved[ key ] ) ? saved[ key ] : value ] ) );
  }
  catch
  {
    return { ...defaults };
  }
};

/**
 * The preferences.
 * @type {import('svelte/store').Writable<typeof defaults>}
 */
const prefs = writable( typeof window === 'undefined' ? { ...defaults } : readPrefs() );

/**
 * @typedef {Object} RoutePoint
 * @property {number} id Running number, stable while the point moves in the list.
 * @property {{ name: string, x: number, y: number }|null} place Chosen place in map pixels,
 *   null while none is chosen.
 * @property {object} field Its place field, from search.createField().
 */

/**
 * Last point number given out.
 * @type {number}
 */
let point_id = 0;

/**
 * The places of the route in order: the start, the stops, and the destination; always at
 * least the start and the destination.
 * @type {import('svelte/store').Writable<RoutePoint[]>}
 */
const points = writable( [] );

/**
 * A new empty point with its place field.
 *
 * @returns {RoutePoint} Point.
 */
const createPoint = () =>
{
  const id = ++point_id;
  return {
    id,
    place: null,
    field: search.createField( {
      onChoose: entry => setPlace( id, { name: entry.name, x: entry.x, y: entry.y } ),
      onClear: () => setPlace( id, null )
    } )
  };
};

points.set( [ createPoint(), createPoint() ] );

/**
 * Number of the point whose place is picked by clicking the map, 0 when none is.
 * @type {import('svelte/store').Writable<number>}
 */
const picking = writable( 0 );

/**
 * The road network as a routing graph, null until loaded.
 * @type {import('svelte/store').Writable<object|null>}
 */
const graph = writable( null );

/**
 * Loading state of the road network: idle, loading, ready or error.
 * @type {import('svelte/store').Writable<string>}
 */
const status = writable( 'idle' );

/**
 * Letter or number of a point on the map and in the panel: A for the start, B for the
 * destination, 1, 2, … for the stops.
 *
 * @param {number} index Position in the list.
 * @param {number} count Number of points.
 * @returns {string} Label.
 */
const labelOf = ( index, count ) =>
{
  if ( index === 0 ) return 'A';
  if ( index === count - 1 ) return 'B';
  return String( index );
};

/**
 * Name of a point's role: Start, Destination or Stop 1, 2, ….
 *
 * @param {number} index Position in the list.
 * @param {number} count Number of points.
 * @returns {string} Name.
 */
const roleOf = ( index, count ) =>
{
  if ( index === 0 ) return 'Start';
  if ( index === count - 1 ) return 'Destination';
  return `Stop ${ index }`;
};

/**
 * The same role in a sentence: "the start", "stop 1".
 *
 * @param {number} index Position in the list.
 * @param {number} count Number of points.
 * @returns {string} Role in lower case.
 */
const roleInText = ( index, count ) => ( index === 0 || index === count - 1 ? 'the ' : '' ) + roleOf( index, count ).toLowerCase();

/**
 * Points with their label and role, for the panel and the map.
 * @type {import('svelte/store').Readable<(RoutePoint & { label: string, role: string })[]>}
 */
const listed = derived( points, $points => $points.map( ( point, index ) => ( {
  ...point,
  label: labelOf( index, $points.length ),
  role: roleOf( index, $points.length )
} ) ) );

/**
 * Whether the start and the destination are both chosen.
 *
 * @param {RoutePoint[]} list Points.
 * @returns {boolean} True when a route can be planned.
 */
const isComplete = list => Boolean( list[ 0 ].place && list[ list.length - 1 ].place );

/**
 * Set or clear the place of a point; a lone place is shown on the map, a complete route is
 * fitted on screen by the panel.
 *
 * @param {number}                                    id    Point number.
 * @param {{ name: string, x: number, y: number }|null} place Place, null to clear it.
 * @param {boolean}                                   [move] Whether to move the map to a lone
 *   place (true); a place picked on the map is already in view.
 * @returns {void}
 */
const setPlace = ( id, place, move = true ) =>
{
  points.update( list => list.map( point => point.id === id ? { ...point, place } : point ) );
  if ( !place ) return;
  if ( move && !isComplete( get( points ) ) ) view.focus( { x: place.x, y: place.y, scale: place_scale } );
  else view.mark( place );
};

/**
 * Save the preferences.
 *
 * @returns {void}
 */
const savePrefs = () =>
{
  try
  {
    window.localStorage.setItem( storage_key, JSON.stringify( get( prefs ) ) );
  }
  catch
  {
    // storage can be unavailable (private mode); the choice then lasts until reload
  }
};

/**
 * Join words into a list: "a, b or c".
 *
 * @param {string[]} words Words.
 * @returns {string} The list.
 */
const orList = words => words.length > 1 ? `${ words.slice( 0, -1 ).join( ', ' ) } or ${ words[ words.length - 1 ] }` : words.join( '' );

/**
 * Why there is no route, in a sentence.
 *
 * @param {object}   plan   Answer of planRoute().
 * @param {object[]} chosen Points with a place, in order, with their index and count.
 * @returns {string} Explanation.
 */
const explain = ( plan, chosen ) =>
{
  const role = point => roleInText( point.index, point.count );
  if ( plan.reason === 'far' )
  {
    const text = role( chosen[ plan.place ] );
    return `${ text[ 0 ].toUpperCase() }${ text.slice( 1 ) } is more than ${ Math.round( MAX_SNAP * METRES_PER_PIXEL / 10 ) * 10 } m from a road known to the planner.`;
  }

  const from = role( chosen[ plan.leg ] ),
        to = role( chosen[ plan.leg + 1 ] );
  if ( plan.reason === 'island' )
  {
    return `No road links ${ from } to ${ to }: they lie on separate road networks, such as an island or a land mass reached only by sea, or the traced roads have a gap there.`;
  }

  const words = plan.opening.map( key => options.find( option => option.key === key ).territory.replace( /^a /, '' ).replace( 'region', 'regions' ) );
  return words.length
    ? `Every road from ${ from } to ${ to } goes through ${ orList( words ) }. Change the options below to allow it.`
    : `The options leave no road from ${ from } to ${ to }; allow more territory below.`;
};

/**
 * Options the route changed by itself, as notes per option: "Switched on: the destination is
 * in enemy territory."
 *
 * @param {{ option: string, place: number }[]} auto   Changes from planRoute().
 * @param {object[]}                            chosen Points with a place, in order.
 * @returns {Record<string, string>} Note by option key.
 */
const autoNotes = ( auto, chosen ) => Object.fromEntries( auto.map( change =>
{
  const option = options.find( entry => entry.key === change.option ),
        point = chosen[ change.place ],
        switched = change.option.startsWith( 'avoid' ) ? 'off' : 'on';
  return [ change.option, `Switched ${ switched }: ${ roleInText( point.index, point.count ) } is in ${ option.territory }.` ];
} ) );

/**
 * The planned route, worked out again when the places, the preferences, the road network or
 * the territory change; null without a team, a road network, or a start and a destination.
 * ok: false with a message when there is no route. Distances in km.
 * @type {import('svelte/store').Readable<object|null>}
 */
const result = derived( [ prefs, points, graph, territory.states, territory.fighting ], ( [ $prefs, $points, $graph, $states, $fighting ] ) =>
{
  if ( !$prefs.team || !$graph || !isComplete( $points ) ) return null;

  // empty stops are left out
  const chosen = $points
    .map( ( point, index ) => ( { ...point, index, count: $points.length, label: labelOf( index, $points.length ) } ) )
    .filter( point => point.place );

  const plan = planRoute( $graph, {
    places: chosen.map( point => point.place ),
    territory: buildTerritory( $states, $prefs.team, $fighting ),
    options: {
      mode: $prefs.mode,
      ...Object.fromEntries( Object.keys( DEFAULT_OPTIONS ).map( key => [ key, $prefs[ key ] ] ) )
    }
  } );

  const answer = { options: plan.options, notes: autoNotes( plan.auto, chosen ) };
  if ( !plan.ok ) return { ...answer, ok: false, message: explain( plan, chosen ) };

  const road = toKm( plan.road ),
        offroad = toKm( plan.offroad );
  return {
    ...answer,
    ok: true,
    km: road + offroad,
    offroad,
    legs: plan.legs.map( ( leg, index ) => ( {
      ...leg,
      from: chosen[ index ],
      to: chosen[ index + 1 ],
      km: toKm( leg.road + leg.offroad )
    } ) ),
    byClass: CLASSES
      .filter( cls => plan.byClass[ cls ] > 0 )
      .map( cls => ( { cls, name: class_names[ cls ], km: toKm( plan.byClass[ cls ] ) } ) ),
    fuel: estimateFuel( road, offroad, $prefs.vehicle )
  };
} );

/**
 * Signature of the start and destination of the last route fitted on screen, so a route is
 * fitted once when it is complete or its ends change, not on every refresh of the territory,
 * nor when a stop is added, picked, moved or removed: that keeps the map where the viewer is
 * looking.
 * @type {string}
 */
let fitted = '';

/**
 * Signature of the start and the destination of the route.
 *
 * @returns {string} Both places.
 */
const endsSignature = () =>
{
  const list = get( points );
  return [ list[ 0 ], list[ list.length - 1 ] ].map( point => point.place ? `${ point.place.x },${ point.place.y }` : '' ).join( ';' );
};

export const route = {
  prefs: { subscribe: prefs.subscribe },
  points: { subscribe: listed.subscribe },
  picking: { subscribe: picking.subscribe },
  status: { subscribe: status.subscribe },
  result: { subscribe: result.subscribe },

  /**
   * Whether anything of a route is on the map: a place, or a point being picked.
   * @type {import('svelte/store').Readable<boolean>}
   */
  shown: derived( [ points, picking ], ( [ $points, $picking ] ) => Boolean( $picking ) || $points.some( point => point.place ) ),

  teams,
  modes,
  options,
  vehicles: VEHICLE_CLASSES.map( vehicle => ( { ...vehicle, hint: `Fuel for ${ vehicle.label }`, figures: classFigures( vehicle.key ) } ) ),
  margin: SAFETY_MARGIN,
  gameVersion: GAME_VERSION,

  /**
   * Load the road network, once (stores/roads.js, shared with the road layer), and prepare it
   * for routing.
   *
   * @returns {Promise<void>}
   */
  async load()
  {
    if ( get( status ) === 'loading' || get( status ) === 'ready' ) return;
    status.set( 'loading' );
    const network = await roads.load();
    if ( !network )
    {
      console.error( 'The road network could not be loaded' );
      status.set( 'error' );
      return;
    }
    graph.set( prepareGraph( network, territory.locate ) );
    status.set( 'ready' );
  },

  /**
   * Change a preference and remember it.
   *
   * @param {string}         key   Preference name: team, mode, vehicle or an option.
   * @param {string|boolean} value New value.
   * @returns {void}
   */
  setPref( key, value )
  {
    if ( !isValid( key, value ) ) return;
    prefs.update( current => ( { ...current, [ key ]: value } ) );
    savePrefs();
  },

  /**
   * Add an empty stop before the destination.
   *
   * @returns {void}
   */
  addStop()
  {
    points.update( list => [ ...list.slice( 0, -1 ), createPoint(), list[ list.length - 1 ] ] );
  },

  /**
   * Remove a stop; the start and the destination stay.
   *
   * @param {number} id Point number.
   * @returns {void}
   */
  removeStop( id )
  {
    points.update( list =>
    {
      const index = list.findIndex( point => point.id === id );
      return index > 0 && index < list.length - 1 ? list.filter( point => point.id !== id ) : list;
    } );
    if ( get( picking ) === id ) picking.set( 0 );
  },

  /**
   * Move a point up or down the route; moving a stop above the start makes it the start.
   *
   * @param {number} id   Point number.
   * @param {number} step -1 for up, 1 for down.
   * @returns {void}
   */
  move( id, step )
  {
    points.update( list =>
    {
      const index = list.findIndex( point => point.id === id ),
            other = index + step;
      if ( index < 0 || other < 0 || other >= list.length ) return list;
      const moved = [ ...list ];
      [ moved[ index ], moved[ other ] ] = [ moved[ other ], moved[ index ] ];
      return moved;
    } );
  },

  /**
   * Start picking a point's place on the map, or stop when it was already being picked.
   *
   * @param {number} id Point number.
   * @returns {void}
   */
  togglePicking( id )
  {
    picking.update( current => current === id ? 0 : id );
  },

  /**
   * Stop picking on the map.
   *
   * @returns {void}
   */
  stopPicking()
  {
    picking.set( 0 );
  },

  /**
   * Use a clicked map point as the place of the point being picked, named after the nearest
   * place: "Map point – The Spine, Dead Lands".
   *
   * @param {number} x Map x.
   * @param {number} y Map y.
   * @returns {void}
   */
  pick( x, y )
  {
    const id = get( picking ),
          point = get( points ).find( entry => entry.id === id );
    if ( !point ) return;

    const where = territory.locate( x, y ),
          bounds = grid.bounds( where.hex ),
          near = bounds ? search.placeOf( where.hex, { x: ( x - bounds.x ) / bounds.width, y: ( y - bounds.y ) / bounds.height } ) : '',
          name = near ? `Map point – ${ near }` : 'Map point';

    point.field.show( name );
    picking.set( 0 );
    setPlace( id, { name, x, y }, false );
  },

  /**
   * Fit the route, or else the chosen places, on screen.
   *
   * @param {{ left: number, right: number }} [inset] Screen width covered by the panel on
   *   either side, in CSS pixels, which the view keeps clear.
   * @returns {void}
   */
  fit( inset = { left: 0, right: 0 } )
  {
    const current = get( result ),
          xs = [],
          ys = [];
    get( points ).forEach( point =>
    {
      if ( !point.place ) return;
      xs.push( point.place.x );
      ys.push( point.place.y );
    } );
    if ( current && current.ok ) current.legs.forEach( leg => leg.pieces.forEach( piece => piece.points.forEach( ( [ x, y ] ) =>
    {
      xs.push( x );
      ys.push( y );
    } ) ) );
    if ( !xs.length ) return;

    const x0 = Math.min( ...xs ),
          x1 = Math.max( ...xs ),
          y0 = Math.min( ...ys ),
          y1 = Math.max( ...ys );
    view.focus( {
      x: ( x0 + x1 ) / 2,
      y: ( y0 + y1 ) / 2,
      box: { width: Math.max( x1 - x0, min_box ), height: Math.max( y1 - y0, min_box ) },
      marker: false,
      inset
    } );
  },

  /**
   * Fit the route on screen when its start or destination changed since the last fit.
   *
   * @param {{ left: number, right: number }} [inset] Screen width covered by the panel.
   * @returns {void}
   */
  fitNew( inset = { left: 0, right: 0 } )
  {
    const signature = endsSignature();
    if ( signature === fitted ) return;
    fitted = signature;
    route.fit( inset );
  },

  /**
   * Empty every place and remove the stops.
   *
   * @returns {void}
   */
  clear()
  {
    picking.set( 0 );
    fitted = '';
    points.set( [ createPoint(), createPoint() ] );
  }
};
