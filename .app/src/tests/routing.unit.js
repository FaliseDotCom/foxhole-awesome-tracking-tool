import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareGraph, planRoute, buildTerritory, classify, autoOptions, snap, toKm, DEFAULT_OPTIONS, MAX_SNAP } from '../lib/routing.js';
import { createRegionIndex } from '../lib/regions.js';
import { classFigures, estimateFuel, litresPerKm, SAFETY_MARGIN, VEHICLES, VEHICLE_CLASSES } from '../lib/vehicles.js';

// unit tests for the route planner; run with `npm run test:unit`

/**
 * A small road network shaped like a diamond, with a separate island road:
 *
 *            1 (100, 0)            north: the short way, 283 px
 *          /            \
 *   0 (0, 100)        2 (200, 100)
 *          \            /
 *           3 (100, 300)           south: the long way, 447 px
 *
 *   island: 4 (1000, 1000) – 5 (1100, 1000)
 * @type {object}
 */
const roads = {
  nodes: [ [ 0, 100 ], [ 100, 0 ], [ 200, 100 ], [ 100, 300 ], [ 1000, 1000 ], [ 1100, 1000 ] ],
  edges: [
    { a: 0, b: 1, hex: 'H', points: [ [ 0, 100 ], [ 100, 0 ] ] },
    { a: 1, b: 2, hex: 'H', points: [ [ 100, 0 ], [ 200, 100 ] ] },
    { a: 0, b: 3, hex: 'H', points: [ [ 0, 100 ], [ 50, 200 ], [ 100, 300 ] ] },
    { a: 3, b: 2, hex: 'H', points: [ [ 100, 300 ], [ 150, 200 ], [ 200, 100 ] ] },
    { a: 4, b: 5, hex: 'H', points: [ [ 1000, 1000 ], [ 1100, 1000 ] ] }
  ]
};

/**
 * Regions of the test map by height: north above y 60, middle (where the places are) up to
 * y 150, south below.
 *
 * @param {number} x Map x.
 * @param {number} y Map y.
 * @returns {{ hex: string, area: string, key: string }} Region.
 */
const locate = ( x, y ) =>
{
  const area = y < 60 ? 'North' : ( y <= 150 ? 'Middle' : 'South' );
  return { hex: 'H', area, key: `H/${ area }` };
};

/**
 * The test graph.
 * @type {object}
 */
const graph = prepareGraph( roads, locate );

/**
 * Territory for the Wardens with the north held by a team (or neutral), the rest Warden.
 *
 * @param {string}  north    Holder of the north: W, C or ''.
 * @param {object}  [extra]  Other state of the north (scorched).
 * @param {object}  [south]  State of the south.
 * @returns {object} Territory by region key.
 */
const territory = ( north, extra = {}, south = {} ) => buildTerritory( {
  'H/North': { hex: 'H', team: north, scorched: false, ...extra },
  'H/Middle': { hex: 'H', team: 'W', scorched: false },
  'H/South': { hex: 'H', team: 'W', scorched: false, ...south }
}, 'W', new Set() );

/**
 * Start and destination on either side of the diamond.
 * @type {{ x: number, y: number }[]}
 */
const across = [ { x: 0, y: 100 }, { x: 200, y: 100 } ];

/**
 * Plan a route across the diamond.
 *
 * @param {object} land    Territory.
 * @param {object} options Options over the defaults, with the mode.
 * @param {object[]} [places] Places of the route.
 * @returns {object} Answer of planRoute().
 */
const plan = ( land, options, places = across ) => planRoute( graph, { places, territory: land, options: { ...DEFAULT_OPTIONS, mode: 'shortest', ...options } } );

/**
 * Regions a route runs through, in order.
 *
 * @param {object} answer Answer of planRoute().
 * @returns {string[]} Region keys.
 */
const regionsOf = answer => answer.legs.flatMap( leg => leg.pieces.map( piece => piece.key ) );

test( 'the shortest route takes the shorter road', () =>
{
  const answer = plan( territory( '' ), { mode: 'shortest' } );
  assert.equal( answer.ok, true );
  assert.ok( Math.abs( answer.road - 2 * Math.hypot( 100, 100 ) ) < .01 );
  assert.deepEqual( regionsOf( answer ), [ 'H/North' ] );
} );

test( 'the safest route takes a longer road to stay on friendly ground', () =>
{
  const answer = plan( territory( '' ), { mode: 'safest' } );
  assert.equal( answer.ok, true );
  assert.ok( Math.abs( answer.road - 2 * Math.hypot( 100, 200 ) ) < .01 );
  assert.deepEqual( regionsOf( answer ), [ 'H/Middle', 'H/South', 'H/Middle' ] );
  assert.equal( answer.byClass.neutral, 0 );
} );

test( 'the safest route takes neutral ground rather than a detour through contested ground', () =>
{
  // the neutral north costs twice its length; the south, contested halfway, costs about twice
  // as much as that
  const contested = buildTerritory( {
    'H/North': { hex: 'H', team: '', scorched: false },
    'H/Middle': { hex: 'H', team: 'W', scorched: false },
    'H/South': { hex: 'S', team: 'W', scorched: false }
  }, 'W', new Set( [ 'S' ] ) );
  assert.deepEqual( regionsOf( plan( contested, { mode: 'safest' } ) ), [ 'H/North' ] );
} );

test( 'enemy territory is left out unless allowed', () =>
{
  const enemy = territory( 'C' );
  assert.deepEqual( regionsOf( plan( enemy, { mode: 'shortest' } ) ), [ 'H/Middle', 'H/South', 'H/Middle' ] );
  assert.deepEqual( regionsOf( plan( enemy, { mode: 'shortest', enemy: true } ) ), [ 'H/North' ] );
} );

test( 'a route closed by the options says which option would open it', () =>
{
  const contested = buildTerritory( {
    'H/North': { hex: 'H', team: 'C', scorched: false },
    'H/Middle': { hex: 'H', team: 'W', scorched: false },
    'H/South': { hex: 'S', team: 'W', scorched: false }
  }, 'W', new Set( [ 'S' ] ) );
  const answer = plan( contested, { contested: false } );
  assert.equal( answer.ok, false );
  assert.equal( answer.reason, 'blocked' );
  assert.equal( answer.leg, 0 );
  assert.deepEqual( answer.opening.sort(), [ 'contested', 'enemy' ] );
} );

test( 'avoiding scorched and neutral regions takes another road', () =>
{
  assert.deepEqual( regionsOf( plan( territory( 'W', { scorched: true } ), { avoidScorched: true } ) ), [ 'H/Middle', 'H/South', 'H/Middle' ] );
  assert.deepEqual( regionsOf( plan( territory( '' ), { avoidNeutral: true } ) ), [ 'H/Middle', 'H/South', 'H/Middle' ] );
  assert.deepEqual( regionsOf( plan( territory( 'W', { scorched: true } ), {} ) ), [ 'H/North' ] );
} );

test( 'a place in enemy territory switches the enemy option on', () =>
{
  // the destination lies in the north, near the road from 1 to 2
  const answer = plan( territory( 'C' ), {}, [ { x: 0, y: 100 }, { x: 170, y: 40 } ] );
  assert.equal( answer.ok, true );
  assert.equal( answer.options.enemy, true );
  assert.deepEqual( answer.auto, [ { option: 'enemy', place: 1 } ] );
} );

test( 'automatic options cover contested, neutral and scorched places, once each', () =>
{
  const places = [ { cls: 'contested', scorched: false }, { cls: 'neutral', scorched: true }, { cls: 'contested', scorched: false } ];
  const { options, auto } = autoOptions( { ...DEFAULT_OPTIONS, contested: false, avoidNeutral: true, avoidScorched: true }, places );
  assert.deepEqual( options, { ...DEFAULT_OPTIONS, contested: true, avoidNeutral: false, avoidScorched: false } );
  assert.deepEqual( auto, [ { option: 'contested', place: 0 }, { option: 'avoidNeutral', place: 1 }, { option: 'avoidScorched', place: 1 } ] );
  assert.deepEqual( autoOptions( DEFAULT_OPTIONS, [ { cls: 'friendly', scorched: false } ] ).auto, [] );
} );

test( 'regions are classified for the viewer\'s team', () =>
{
  assert.equal( classify( { team: 'C' }, 'W', false ), 'enemy' );
  assert.equal( classify( { team: 'C' }, 'W', true ), 'enemy' );
  assert.equal( classify( { team: 'W' }, 'W', true ), 'contested' );
  assert.equal( classify( { team: '' }, 'W', true ), 'contested' );
  assert.equal( classify( { team: 'W' }, 'W', false ), 'friendly' );
  assert.equal( classify( { team: '' }, 'C', false ), 'neutral' );
  assert.equal( classify( { team: 'W' }, 'C', false ), 'enemy' );
} );

test( 'stops make a route of chained legs', () =>
{
  const answer = plan( territory( '' ), { mode: 'shortest' }, [ { x: 0, y: 100 }, { x: 100, y: 300 }, { x: 200, y: 100 } ] );
  assert.equal( answer.ok, true );
  assert.equal( answer.legs.length, 2 );
  answer.legs.forEach( leg => assert.ok( Math.abs( leg.road - Math.hypot( 100, 200 ) ) < .01 ) );
  assert.ok( Math.abs( answer.road - 2 * Math.hypot( 100, 200 ) ) < .01 );
} );

test( 'places snap to the nearest point of a road, and the gap counts as off-road', () =>
{
  const point = snap( graph, 60, 60 );
  assert.equal( point.edge, 0 );
  assert.ok( Math.abs( point.x - 50 ) < .01 && Math.abs( point.y - 50 ) < .01 );

  // both places on the same road: straight along it
  const answer = plan( territory( '' ), {}, [ { x: 60, y: 60 }, { x: 90, y: 20 } ] );
  assert.equal( answer.ok, true );
  assert.ok( Math.abs( answer.road - Math.hypot( 35, 35 ) ) < .01 );
  assert.ok( Math.abs( answer.offroad - point.distance - snap( graph, 90, 20 ).distance ) < .01 );
} );

test( 'there is no route to an island, or from a place far from any road', () =>
{
  const island = plan( territory( '' ), {}, [ { x: 0, y: 100 }, { x: 1050, y: 1000 } ] );
  assert.equal( island.ok, false );
  assert.equal( island.reason, 'island' );

  const far = plan( territory( '' ), {}, [ { x: 0, y: 100 }, { x: 600, y: 600 } ] );
  assert.equal( far.ok, false );
  assert.equal( far.reason, 'far' );
  assert.equal( far.place, 1 );
  assert.ok( snap( graph, 600, 600 ).distance > MAX_SNAP );
} );

test( 'distances are in km, a hex being 2,184 m wide', () =>
{
  assert.equal( toKm( 1024 ), 2.184 );
  assert.equal( toKm( 0 ), 0 );
} );

test( 'fuel is estimated on the high side: thirstiest vehicle of the class, loaded, with a margin', () =>
{
  assert.equal( VEHICLE_CLASSES.length, 3 );
  VEHICLE_CLASSES.forEach( vehicle => assert.ok( VEHICLES.some( entry => entry.cls === vehicle.key ) ) );

  const fast = classFigures( 'fast' ),
        medium = classFigures( 'medium' ),
        truck = VEHICLES[ 0 ],
        tanker = VEHICLES[ 1 ];
  // trucks have a class of their own: the estimate is the loaded truck's use, not the tanker's
  assert.ok( Math.abs( fast.road - litresPerKm( truck.use, truck.road * ( 1 - truck.load ) ) ) < 1e-9 );
  assert.ok( fast.road > litresPerKm( truck.use, truck.road ) );
  assert.equal( fast.tank, 100 );
  // the tanker drives with the heavy-duty trucks, and its 100 L is the class's smallest tank
  assert.ok( medium.vehicles.includes( tanker.name ) );
  assert.ok( medium.road >= litresPerKm( tanker.use, tanker.road * ( 1 - tanker.load ) ) );
  assert.equal( medium.tank, 100 );

  const fuel = estimateFuel( 10, 1, 'fast' );
  assert.equal( fuel.litres, Math.ceil( ( 10 * fast.road + fast.offroad ) * SAFETY_MARGIN ) );
  assert.ok( fuel.litres > 10 * litresPerKm( truck.use, truck.road ) * 1.2 );
  assert.equal( fuel.overTank, false );
  assert.equal( estimateFuel( 30, 0, 'fast' ).overTank, false );
  assert.equal( estimateFuel( 50, 0, 'fast' ).overTank, true );
  assert.equal( estimateFuel( 30, 0, 'medium' ).overTank, true );
  assert.equal( estimateFuel( 0, 0, 'unknown' ).litres, 0 );
} );

test( 'a point lies in the region outline around it, or else in the region named nearest', () =>
{
  const index = createRegionIndex( [ {
    key: 'TestHex', x: 0, y: 0, width: 1024, height: 888,
    areas: [
      { name: 'West', label: [ 300, 444 ], outline: [ [ 256, 0 ], [ 512, 0 ], [ 512, 888 ], [ 256, 888 ], [ 0, 444 ] ] },
      { name: 'East', label: [ 800, 444 ], outline: [] }
    ]
  }, {
    key: 'OtherHex', x: 768, y: 444, width: 1024, height: 888, areas: []
  } ] );
  assert.deepEqual( index.locate( 400, 400 ), { hex: 'TestHex', area: 'West', key: 'TestHex/West' } );
  assert.equal( index.locate( 700, 400 ).area, 'East' );
  // the lower right corner of the first image is in the next hexagon
  assert.equal( index.locate( 1000, 860 ).hex, 'OtherHex' );
  // outside every hexagon: the hint, else the nearest hex
  assert.equal( index.locate( -50, -50, 'OtherHex' ).hex, 'OtherHex' );
  assert.equal( index.locate( -50, -50 ).hex, 'TestHex' );
} );

/**
 * The real road network and world data, as the app loads them.
 *
 * @returns {object} Graph over assets/data/roads.json with the regions of world_data.json.
 */
const realGraph = () =>
{
  const world = JSON.parse( readFileSync( new URL( '../stores/world_data.json', import.meta.url ) ) ),
        network = JSON.parse( readFileSync( new URL( '../../../assets/data/roads.json', import.meta.url ) ) );
  // the same hex bounds and outlines as stores/grid.js and stores/territory.js
  const hexes = Object.entries( world ).map( ( [ key, hex ] ) =>
  {
    const x = parseInt( hex.col * 1024 / 1.333 ),
          y = parseInt( hex.row * 888 / 2 ),
          points = Object.fromEntries( Object.entries( hex.points || {} ).map( ( [ name, raw ] ) =>
          {
            const [ fx, fy ] = raw.split( ' ' ).map( Number );
            return [ name, [ x + fx * 1024, y + fy * 888 ] ];
          } ) );
    return {
      key, x, y, width: 1024, height: 888,
      areas: Object.entries( hex.areas || {} ).map( ( [ name, area ] ) => ( {
        name,
        label: [ x + area.x * 1024, y + area.y * 888 ],
        outline: area.points.split( ' ' ).filter( point => point in points ).map( point => points[ point ] )
      } ) )
    };
  } );
  return { graph: prepareGraph( network, createRegionIndex( hexes ).locate ), hexes };
};

test( 'on the real road network a route crosses the mainland quickly, and an island has none', () =>
{
  const { graph: real, hexes } = realGraph(),
        centre = key =>
        {
          const hex = hexes.find( entry => entry.key === key );
          return { x: hex.x + hex.width / 2, y: hex.y + hex.height / 2 };
        },
        land = buildTerritory( Object.fromEntries( real.regions.map( key => [ key, { hex: key.split( '/' )[ 0 ], team: 'W', scorched: false } ] ) ), 'W', new Set() );

  const started = performance.now(),
        answer = planRoute( real, { places: [ centre( 'DeadLandsHex' ), centre( 'WestgateHex' ) ], territory: land, options: { ...DEFAULT_OPTIONS, mode: 'safest' } } ),
        took = performance.now() - started;
  assert.equal( answer.ok, true );
  // Westgate is about three hexes from Dead Lands: more than the straight line, less than twice
  const straight = toKm( Math.hypot( centre( 'WestgateHex' ).x - centre( 'DeadLandsHex' ).x, centre( 'WestgateHex' ).y - centre( 'DeadLandsHex' ).y ) );
  assert.ok( toKm( answer.road ) > straight && toKm( answer.road ) < straight * 2 );
  assert.ok( took < 200, `took ${ took } ms` );

  const island = planRoute( real, { places: [ centre( 'DeadLandsHex' ), centre( 'GodcroftsHex' ) ], territory: land, options: { ...DEFAULT_OPTIONS, mode: 'shortest' } } );
  assert.equal( island.ok, false );
  assert.equal( island.reason, 'island' );
} );
