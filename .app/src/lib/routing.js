/**
 * Route planning over the road network (assets/data/roads.json): A* from place to place, with
 * edge costs from the road length and the territory of the region each piece of road lies in.
 * Pure, so it runs in Node tests; stores/route.js feeds it the live territory. See
 * .docs/plans/2026-11-25-route-planner.md.
 *
 * Distances are in world map pixels unless a name says otherwise; toKm() converts them.
 */

/**
 * Metres per world map pixel: a hex is 2,184 m wide corner to corner and 1,024 px in the image.
 * @type {number}
 */
export const METRES_PER_PIXEL = 2184 / 1024;

/**
 * Furthest a place may be from a road to start or end a route there, in map pixels (about
 * 640 m); further away it counts as having no road.
 * @type {number}
 */
export const MAX_SNAP = 300;

/**
 * Territory classes, from safest to most dangerous.
 * @type {string[]}
 */
export const CLASSES = [ 'friendly', 'neutral', 'contested', 'enemy' ];

/**
 * Extra cost per map pixel of road in the safest mode, per territory class: a piece of road
 * through enemy territory costs 11 times its length, so a detour of up to 11 times as long is
 * taken to avoid it, but not one at any price.
 * @type {Record<string, number>}
 */
export const PENALTIES = { friendly: 0, neutral: 1, contested: 3, enemy: 10 };

/**
 * Route modes: the shortest road, or the safest (length weighed by territory).
 * @type {string[]}
 */
export const MODES = [ 'shortest', 'safest' ];

/**
 * Route options and their defaults: whether the route may go through enemy and contested
 * territory, and whether it avoids neutral and scorched regions.
 * @type {{ enemy: boolean, contested: boolean, avoidNeutral: boolean, avoidScorched: boolean }}
 */
export const DEFAULT_OPTIONS = { enemy: false, contested: true, avoidNeutral: false, avoidScorched: false };

/**
 * Territory of a region nobody knows anything about (a hex without data).
 * @type {{ cls: string, scorched: boolean }}
 */
const unknown = { cls: 'neutral', scorched: false };

/**
 * @typedef {Object} RegionState
 * @property {string} hex World data key of the region's hex.
 * @property {string} team Team holding the region's town hall or relic base: W, C or ''.
 * @property {boolean} scorched Whether the region has scorched structures.
 */

/**
 * @typedef {Object} Options
 * @property {string} mode 'shortest' or 'safest'.
 * @property {boolean} enemy Through enemy territory.
 * @property {boolean} contested Through contested territory.
 * @property {boolean} avoidNeutral Not through neutral regions.
 * @property {boolean} avoidScorched Not through scorched regions.
 */

/**
 * Map pixels to km.
 *
 * @param {number} pixels Distance in map pixels.
 * @returns {number} Distance in km.
 */
export const toKm = pixels => pixels * METRES_PER_PIXEL / 1000;

/**
 * Territory class of a region for a team. A region of the other team is enemy territory; any
 * other region in a hex with fighting is contested; then friendly when the team holds it, and
 * neutral otherwise (no base, a neutral or a scorched one).
 *
 * @param {RegionState} state    Holder of the region.
 * @param {string}      team     The viewer's team: W or C.
 * @param {boolean}     fighting Whether its hex had casualties in the last hour.
 * @returns {string} Class from CLASSES.
 */
export const classify = ( state, team, fighting ) =>
{
  if ( state.team && state.team !== team ) return 'enemy';
  if ( fighting ) return 'contested';
  return state.team === team ? 'friendly' : 'neutral';
};

/**
 * Territory class and scorched state of every region for a team.
 *
 * @param {Record<string, RegionState>} states   Region states by region key.
 * @param {string}                      team     The viewer's team: W or C.
 * @param {Set<string>}                 fighting Hexes with casualties in the last hour.
 * @returns {Record<string, { cls: string, scorched: boolean }>} Territory by region key.
 */
export const buildTerritory = ( states, team, fighting ) => Object.fromEntries(
  Object.entries( states ).map( ( [ key, state ] ) => [ key, { cls: classify( state, team, fighting.has( state.hex ) ), scorched: state.scorched } ] )
);

/**
 * Territory of a region, neutral when unknown.
 *
 * @param {Record<string, { cls: string, scorched: boolean }>} territory Territory by region key.
 * @param {string}                                             key       Region key.
 * @returns {{ cls: string, scorched: boolean }} Its territory.
 */
const territoryOf = ( territory, key ) => territory[ key ] || unknown;

/**
 * Turn the road network into a graph for routing: per edge its pieces (polyline segments) with
 * their length and region, the edges at every node, and which nodes are connected at all.
 *
 * @param {{ nodes: number[][], edges: { a: number, b: number, hex: string, points: number[][] }[] }} roads
 *   The road network as in assets/data/roads.json.
 * @param {function( number, number, string ): { key: string }} locate Region of a point, see
 *   lib/regions.js; the third argument is the hex the edge was traced in.
 * @returns {object} Graph for snap() and planRoute().
 */
export const prepareGraph = ( roads, locate ) =>
{
  const region_ids = new Map(),
        regions = [],
        adjacency = roads.nodes.map( () => [] );

  /**
   * Number of a region key, added when new.
   *
   * @param {string} key Region key.
   * @returns {number} Its number.
   */
  const regionId = key =>
  {
    if ( !region_ids.has( key ) )
    {
      region_ids.set( key, regions.length );
      regions.push( key );
    }
    return region_ids.get( key );
  };

  const edges = roads.edges.map( ( edge, index ) =>
  {
    const points = edge.points,
          count = Math.max( 0, points.length - 1 ),
          lengths = new Float64Array( count ),
          starts = new Float64Array( count ),
          pieces = new Int32Array( count );
    let total = 0;

    for ( let i = 0; i < count; i++ )
    {
      const [ x0, y0 ] = points[ i ],
            [ x1, y1 ] = points[ i + 1 ];
      lengths[ i ] = Math.hypot( x1 - x0, y1 - y0 );
      starts[ i ] = total;
      total += lengths[ i ];
      // the middle of a segment decides its region; segments are short after simplification
      pieces[ i ] = regionId( locate( ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, edge.hex ).key );
    }

    adjacency[ edge.a ].push( index );
    if ( edge.b !== edge.a ) adjacency[ edge.b ].push( index );
    return { a: edge.a, b: edge.b, points, lengths, starts, regions: pieces, length: total };
  } );

  return {
    nodes: roads.nodes,
    edges,
    adjacency,
    regions,
    component: components( roads.nodes.length, edges, adjacency ),
    locate
  };
};

/**
 * Connected part of the network each node belongs to, so places on separate networks (islands,
 * land masses without a road link) are known to have no route without searching.
 *
 * @param {number}     count     Number of nodes.
 * @param {object[]}   edges     Graph edges.
 * @param {number[][]} adjacency Edges per node.
 * @returns {Int32Array} Component number per node.
 */
const components = ( count, edges, adjacency ) =>
{
  const component = new Int32Array( count ).fill( -1 );
  let next = 0;

  for ( let start = 0; start < count; start++ )
  {
    if ( component[ start ] >= 0 ) continue;
    const stack = [ start ];
    component[ start ] = next;
    while ( stack.length )
    {
      const node = stack.pop();
      for ( const index of adjacency[ node ] )
      {
        const edge = edges[ index ],
              other = edge.a === node ? edge.b : edge.a;
        if ( component[ other ] >= 0 ) continue;
        component[ other ] = next;
        stack.push( other );
      }
    }
    next++;
  }
  return component;
};

/**
 * Nearest point on any road.
 *
 * @param {object} graph Graph from prepareGraph().
 * @param {number} x     Map x.
 * @param {number} y     Map y.
 * @returns {{ edge: number, offset: number, x: number, y: number, distance: number }} The edge,
 *   how far along it the point is, the point itself, and its distance from x, y; edge -1
 *   without roads.
 */
export const snap = ( graph, x, y ) =>
{
  let best = { edge: -1, offset: 0, x, y, distance: Infinity };

  graph.edges.forEach( ( edge, index ) =>
  {
    const points = edge.points;
    for ( let i = 0; i < edge.lengths.length; i++ )
    {
      const [ x0, y0 ] = points[ i ],
            [ x1, y1 ] = points[ i + 1 ],
            length = edge.lengths[ i ],
            along = length ? ( ( x - x0 ) * ( x1 - x0 ) + ( y - y0 ) * ( y1 - y0 ) ) / ( length * length ) : 0,
            t = Math.min( 1, Math.max( 0, along ) ),
            px = x0 + t * ( x1 - x0 ),
            py = y0 + t * ( y1 - y0 ),
            distance = Math.hypot( x - px, y - py );
      if ( distance < best.distance ) best = { edge: index, offset: edge.starts[ i ] + t * length, x: px, y: py, distance };
    }
  } );
  return best;
};

/**
 * Cost factor of a piece of road per map pixel in a region; Infinity where the options forbid
 * the route to go.
 *
 * @param {{ cls: string, scorched: boolean }} info    Territory of the region.
 * @param {Options}                            options Route options.
 * @returns {number} Factor, at least 1.
 */
const factorOf = ( info, options ) =>
{
  if ( info.cls === 'enemy' && !options.enemy ) return Infinity;
  if ( info.cls === 'contested' && !options.contested ) return Infinity;
  if ( info.cls === 'neutral' && options.avoidNeutral ) return Infinity;
  if ( info.scorched && options.avoidScorched ) return Infinity;
  return options.mode === 'safest' ? 1 + PENALTIES[ info.cls ] : 1;
};

/**
 * Cost factor per region of the graph.
 *
 * @param {object}  graph     Graph from prepareGraph().
 * @param {object}  territory Territory by region key.
 * @param {Options} options   Route options.
 * @returns {Float64Array} Factor per region number.
 */
const regionFactors = ( graph, territory, options ) =>
  Float64Array.from( graph.regions, key => factorOf( territoryOf( territory, key ), options ) );

/**
 * Cost of a part of an edge, between two offsets along it.
 *
 * @param {object}       edge    Graph edge.
 * @param {Float64Array} factors Factor per region number.
 * @param {number}       from    Offset where the part starts, in map pixels.
 * @param {number}       to      Offset where it ends; the order does not matter.
 * @returns {number} Cost, Infinity when the part crosses a forbidden region.
 */
const partCost = ( edge, factors, from, to ) =>
{
  const low = Math.min( from, to ),
        high = Math.max( from, to );
  let cost = 0;
  for ( let i = 0; i < edge.lengths.length; i++ )
  {
    const start = edge.starts[ i ],
          overlap = Math.min( high, start + edge.lengths[ i ] ) - Math.max( low, start );
    if ( overlap <= 0 ) continue;
    const factor = factors[ edge.regions[ i ] ];
    if ( factor === Infinity ) return Infinity;
    cost += overlap * factor;
  }
  return cost;
};

/**
 * Pieces of an edge between two offsets, in the direction travelled, one per run of segments in
 * the same region.
 *
 * @param {object} edge Graph edge.
 * @param {number} from Offset where the route enters the edge.
 * @param {number} to   Offset where it leaves; smaller than from when driving it backwards.
 * @returns {{ region: number, length: number, points: number[][] }[]} Pieces.
 */
const sliceEdge = ( edge, from, to ) =>
{
  const low = Math.min( from, to ),
        high = Math.max( from, to ),
        pieces = [];

  /**
   * Point a fraction along a segment.
   *
   * @param {number} i Segment number.
   * @param {number} t Fraction, 0 at its start.
   * @returns {number[]} [ x, y ].
   */
  const pointAt = ( i, t ) =>
  {
    const [ x0, y0 ] = edge.points[ i ],
          [ x1, y1 ] = edge.points[ i + 1 ];
    return [ x0 + t * ( x1 - x0 ), y0 + t * ( y1 - y0 ) ];
  };

  for ( let i = 0; i < edge.lengths.length; i++ )
  {
    const start = edge.starts[ i ],
          length = edge.lengths[ i ],
          a = Math.max( low, start ),
          b = Math.min( high, start + length );
    if ( b - a <= 0 ) continue;

    const end = pointAt( i, ( b - start ) / length ),
          region = edge.regions[ i ],
          last = pieces[ pieces.length - 1 ];
    if ( last && last.region === region )
    {
      last.points.push( end );
      last.length += b - a;
    }
    else pieces.push( { region, length: b - a, points: [ pointAt( i, ( a - start ) / length ), end ] } );
  }

  if ( from > to )
  {
    pieces.reverse();
    pieces.forEach( piece => piece.points.reverse() );
  }
  return pieces;
};

/**
 * Join pieces of consecutive parts, merging neighbours in the same region.
 *
 * @param {object[][]} parts Lists of pieces, in route order.
 * @returns {{ region: number, length: number, points: number[][] }[]} One list.
 */
const joinPieces = parts =>
{
  const joined = [];
  for ( const piece of parts.flat() )
  {
    const last = joined[ joined.length - 1 ];
    if ( last && last.region === piece.region )
    {
      last.points.push( ...piece.points.slice( 1 ) );
      last.length += piece.length;
    }
    else joined.push( { ...piece, points: [ ...piece.points ] } );
  }
  return joined;
};

/**
 * Priority queue of nodes by estimated total cost (a binary heap).
 */
class Queue
{
  /**
   * Entries as [ estimate, node, cost so far ].
   * @type {number[][]}
   */
  items = [];

  /**
   * Number of entries.
   *
   * @returns {number} Size.
   */
  get size()
  {
    return this.items.length;
  }

  /**
   * Add an entry.
   *
   * @param {number[]} item [ estimate, node, cost so far ].
   * @returns {void}
   */
  push( item )
  {
    const items = this.items;
    items.push( item );
    let i = items.length - 1;
    while ( i > 0 )
    {
      const parent = ( i - 1 ) >> 1;
      if ( items[ parent ][ 0 ] <= items[ i ][ 0 ] ) break;
      [ items[ parent ], items[ i ] ] = [ items[ i ], items[ parent ] ];
      i = parent;
    }
  }

  /**
   * Take the entry with the lowest estimate.
   *
   * @returns {number[]} [ estimate, node, cost so far ].
   */
  pop()
  {
    const items = this.items,
          top = items[ 0 ],
          last = items.pop();
    if ( items.length )
    {
      items[ 0 ] = last;
      let i = 0;
      for ( ;; )
      {
        const left = i * 2 + 1,
              right = left + 1;
        let smallest = i;
        if ( left < items.length && items[ left ][ 0 ] < items[ smallest ][ 0 ] ) smallest = left;
        if ( right < items.length && items[ right ][ 0 ] < items[ smallest ][ 0 ] ) smallest = right;
        if ( smallest === i ) break;
        [ items[ smallest ], items[ i ] ] = [ items[ i ], items[ smallest ] ];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Cheapest way along the roads from one snapped point to another (A*, with the straight line
 * as estimate; costs are at least the length, so the estimate never overshoots).
 *
 * @param {object}       graph   Graph from prepareGraph().
 * @param {Float64Array} factors Factor per region number.
 * @param {Float64Array} costs   Cost per edge.
 * @param {object}       from    Snapped start, from snap().
 * @param {object}       to      Snapped end, from snap().
 * @returns {{ cost: number, pieces: object[] }|null} The way, null when there is none.
 */
const search = ( graph, factors, costs, from, to ) =>
{
  const { nodes, edges, adjacency } = graph,
        start = edges[ from.edge ],
        end = edges[ to.edge ],
        cost = new Float64Array( nodes.length ).fill( Infinity ),
        previous = new Int32Array( nodes.length ).fill( -1 ),
        through = new Int32Array( nodes.length ).fill( -1 ),
        queue = new Queue(),
        // leaving the network at the end edge, from its first or its last node
        exit_a = partCost( end, factors, 0, to.offset ),
        exit_b = partCost( end, factors, to.offset, end.length );

  /**
   * Straight-line distance from a node to the end.
   *
   * @param {number} node Node number.
   * @returns {number} Distance in map pixels.
   */
  const estimate = node => Math.hypot( nodes[ node ][ 0 ] - to.x, nodes[ node ][ 1 ] - to.y );

  /**
   * Reach a node from the start point along the start edge.
   *
   * @param {number} node  Node number.
   * @param {number} value Cost of getting there.
   * @returns {void}
   */
  const seed = ( node, value ) =>
  {
    if ( value >= cost[ node ] ) return;
    cost[ node ] = value;
    queue.push( [ value + estimate( node ), node, value ] );
  };

  // both points on the same edge: straight along it, unless the network is cheaper
  let best = from.edge === to.edge ? partCost( start, factors, from.offset, to.offset ) : Infinity,
      via = best < Infinity ? -1 : -2,
      exit_at_b = false;

  const enter_a = partCost( start, factors, from.offset, 0 ),
        enter_b = partCost( start, factors, from.offset, start.length );
  seed( start.a, enter_a );
  seed( start.b, enter_b );

  while ( queue.size )
  {
    const [ total, node, value ] = queue.pop();
    if ( total >= best ) break;
    if ( value > cost[ node ] ) continue;

    if ( node === end.a && value + exit_a < best )
    {
      best = value + exit_a;
      via = node;
      exit_at_b = false;
    }
    if ( node === end.b && value + exit_b < best )
    {
      best = value + exit_b;
      via = node;
      exit_at_b = true;
    }

    for ( const index of adjacency[ node ] )
    {
      const edge = edges[ index ],
            other = edge.a === node ? edge.b : edge.a,
            next = value + costs[ index ];
      if ( next >= cost[ other ] ) continue;
      cost[ other ] = next;
      previous[ other ] = node;
      through[ other ] = index;
      queue.push( [ next + estimate( other ), other, next ] );
    }
  }

  if ( via === -2 ) return null;
  if ( via === -1 ) return { cost: best, pieces: sliceEdge( start, from.offset, to.offset ) };

  // walk back from where the route leaves the network to where it joined it
  const steps = [];
  let node = via;
  while ( previous[ node ] >= 0 )
  {
    steps.unshift( { edge: through[ node ], from: previous[ node ] } );
    node = previous[ node ];
  }

  // a loop edge has one node at both ends; the cheaper way round was used
  const entered_at_b = node === start.b && ( node !== start.a || enter_b < enter_a ),
        first = entered_at_b ? sliceEdge( start, from.offset, start.length ) : sliceEdge( start, from.offset, 0 ),
        middle = steps.map( step =>
        {
          const edge = edges[ step.edge ];
          return edge.a === step.from ? sliceEdge( edge, 0, edge.length ) : sliceEdge( edge, edge.length, 0 );
        } ),
        last = exit_at_b ? sliceEdge( end, end.length, to.offset ) : sliceEdge( end, 0, to.offset );

  return { cost: best, pieces: joinPieces( [ first, ...middle, last ] ) };
};

/**
 * Cost per edge for a set of region factors.
 *
 * @param {object}       graph   Graph from prepareGraph().
 * @param {Float64Array} factors Factor per region number.
 * @returns {Float64Array} Cost per edge, Infinity for edges through a forbidden region.
 */
const edgeCosts = ( graph, factors ) => Float64Array.from( graph.edges, edge => partCost( edge, factors, 0, edge.length ) );

/**
 * Options switched on (or, for the avoid options, off) because a place of the route lies in
 * that kind of territory: a route can always start, stop and end where it was asked to.
 *
 * @param {Options}                              options Options as chosen.
 * @param {{ cls: string, scorched: boolean }[]} places  Territory of each place, in order.
 * @returns {{ options: Options, auto: { option: string, place: number }[] }} The options that
 *   apply, and which were changed for which place (the first that needed it).
 */
export const autoOptions = ( options, places ) =>
{
  const effective = { ...options },
        auto = [];

  /**
   * Change an option for a place, once.
   *
   * @param {string}  option Option name.
   * @param {boolean} value  Value it needs.
   * @param {number}  place  Place number.
   * @returns {void}
   */
  const change = ( option, value, place ) =>
  {
    if ( effective[ option ] === value ) return;
    effective[ option ] = value;
    auto.push( { option, place } );
  };

  places.forEach( ( info, place ) =>
  {
    if ( info.cls === 'enemy' ) change( 'enemy', true, place );
    if ( info.cls === 'contested' ) change( 'contested', true, place );
    if ( info.cls === 'neutral' ) change( 'avoidNeutral', false, place );
    if ( info.scorched ) change( 'avoidScorched', false, place );
  } );
  return { options: effective, auto };
};

/**
 * The options that would each, on their own, open a leg the current options leave closed.
 *
 * @param {object}  graph     Graph from prepareGraph().
 * @param {object}  territory Territory by region key.
 * @param {Options} options   Options that apply.
 * @param {object}  from      Snapped start of the leg.
 * @param {object}  to        Snapped end of the leg.
 * @returns {string[]} Option names; empty when no single option is enough.
 */
const openingOptions = ( graph, territory, options, from, to ) =>
{
  const relaxed = { enemy: true, contested: true, avoidNeutral: false, avoidScorched: false };
  return Object.keys( relaxed )
    .filter( option => options[ option ] !== relaxed[ option ] )
    .filter( option =>
    {
      const factors = regionFactors( graph, territory, { ...options, [ option ]: relaxed[ option ] } );
      return search( graph, factors, edgeCosts( graph, factors ), from, to ) !== null;
    } );
};

/**
 * Plan a route through places in order, as chained legs.
 *
 * @param {object} graph Graph from prepareGraph().
 * @param {{ places: { x: number, y: number }[], territory: object, options: Options }} request
 *   At least two places in map pixels, the territory by region key (buildTerritory()), and the
 *   options as chosen.
 * @returns {object} { ok: true, legs, road, offroad, byClass, options, auto } with distances in
 *   map pixels, each leg with its road and off-road length, its pieces (region key, class,
 *   length, points) and the snapped points it starts and ends at; or { ok: false, reason, …,
 *   options, auto } with reason 'far' (place is the place too far from a road), 'island' (leg
 *   between separate road networks) or 'blocked' (leg closed by the options; opening lists the
 *   options that would each open it).
 */
export const planRoute = ( graph, { places, territory, options } ) =>
{
  const snaps = places.map( place => snap( graph, place.x, place.y ) ),
        where = places.map( place => territoryOf( territory, graph.locate( place.x, place.y ).key ) ),
        { options: effective, auto } = autoOptions( options, where ),
        answer = { options: effective, auto };

  const far = snaps.findIndex( point => point.distance > MAX_SNAP );
  if ( far >= 0 ) return { ...answer, ok: false, reason: 'far', place: far };

  const factors = regionFactors( graph, territory, effective ),
        costs = edgeCosts( graph, factors ),
        legs = [];

  for ( let leg = 0; leg < snaps.length - 1; leg++ )
  {
    const from = snaps[ leg ],
          to = snaps[ leg + 1 ];
    if ( graph.component[ graph.edges[ from.edge ].a ] !== graph.component[ graph.edges[ to.edge ].a ] )
    {
      return { ...answer, ok: false, reason: 'island', leg };
    }

    const found = search( graph, factors, costs, from, to );
    if ( !found ) return { ...answer, ok: false, reason: 'blocked', leg, opening: openingOptions( graph, territory, effective, from, to ) };

    const pieces = found.pieces.map( piece =>
    {
      const key = graph.regions[ piece.region ];
      return { key, cls: territoryOf( territory, key ).cls, length: piece.length, points: piece.points };
    } );
    legs.push( {
      road: pieces.reduce( ( sum, piece ) => sum + piece.length, 0 ),
      offroad: from.distance + to.distance,
      pieces,
      start: [ from.x, from.y ],
      end: [ to.x, to.y ]
    } );
  }

  const byClass = Object.fromEntries( CLASSES.map( cls => [ cls, 0 ] ) );
  legs.forEach( leg => leg.pieces.forEach( piece => byClass[ piece.cls ] += piece.length ) );

  return {
    ...answer,
    ok: true,
    legs,
    road: legs.reduce( ( sum, leg ) => sum + leg.road, 0 ),
    offroad: legs.reduce( ( sum, leg ) => sum + leg.offroad, 0 ),
    byClass
  };
};
