import { writable, derived, get } from 'svelte/store';
import { grid } from './grid';
import { world } from './world';
import { icons } from './icons';
import { view } from './view';

/**
 * Map search: places from the static world data (hexes, regions, locations) and structures
 * from the live data of the selected shard. See .docs/plans/2026-10-07-search.md.
 */

/**
 * Most suggestions shown at once.
 * @type {number}
 */
const max_suggestions = 8;

/**
 * Shortest query that gives suggestions.
 * @type {number}
 */
const min_query = 2;

/**
 * Number of recent choices kept, and their localStorage key.
 * @type {number}
 */
const max_recent = 5;
const recent_key = 'fatt-recent';

/**
 * Zoom for points (locations and structures), close enough for icons and minor labels.
 * @type {number}
 */
const point_scale = 1.5;

/**
 * Zoom for regions without an outline, where region names show.
 * @type {number}
 */
const region_scale = .8;

/**
 * Sort order of the kinds, and how each is described in the list.
 * @type {Record<string, { order: number, label: string }>}
 */
const kinds = {
  hex: { order: 0, label: 'Hex' },
  area: { order: 1, label: 'Region' },
  location: { order: 2, label: 'Location' },
  structure: { order: 3, label: 'Structure' }
};

/**
 * Lower case, without accents and punctuation, single spaces: "Callahan's" → "callahans".
 *
 * @param {string} text Text to normalise.
 * @returns {string} Normalised text.
 */
export const normalise = text => text
  .normalize( 'NFD' )
  .replace( /[̀-ͯ]/g, '' )
  .toLowerCase()
  .replace( /['’`]/g, '' )
  .replace( /[^a-z0-9]+/g, ' ' )
  .trim();

/**
 * Add the normalised name and words used for matching to an entry.
 *
 * @param {object} entry   Search entry with a name.
 * @param {string[]} extra Other texts the entry can be found by (hex title, team …).
 * @returns {object} The entry with `key`, `nameWords` and `words`.
 */
const withSearchText = ( entry, extra ) =>
{
  const key = normalise( entry.name );
  return {
    ...entry,
    key,
    nameWords: key.split( ' ' ),
    words: normalise( [ entry.name, ...extra ].join( ' ' ) ).split( ' ' )
  };
};

/**
 * Turn a hex-relative position (0–1) into map pixels.
 *
 * @param {object} bounds Hex bounds from grid.bounds().
 * @param {number} x      Fraction of the hex width.
 * @param {number} y      Fraction of the hex height.
 * @returns {{ x: number, y: number }} Map position.
 */
const toMap = ( bounds, x, y ) => ( { x: bounds.x + x * bounds.width, y: bounds.y + y * bounds.height } );

/**
 * Places: every hex, region and location in the static world data. Built once.
 * @type {object[]}
 */
let places = null;

/**
 * Named places per hex with their map position, used to name structures by the nearest one.
 * @type {Record<string, { name: string, x: number, y: number }[]>}
 */
const named = {};

/**
 * Build the place index from world_data.json.
 *
 * @returns {object[]} Place entries.
 */
const getPlaces = () =>
{
  if ( places ) return places;
  places = [];

  for ( const hex of grid.items )
  {
    const data = grid.world[ hex ],
          bounds = grid.bounds( hex ),
          title = data.title;

    named[ hex ] = [];
    places.push( withSearchText( {
      kind: 'hex', name: title, hex, hexTitle: title,
      x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
      box: { width: bounds.width, height: bounds.height }
    }, [] ) );

    const outlines = grid.getPolyArrays( hex ) || {};
    for ( const [ name, area ] of Object.entries( data.areas || {} ) )
    {
      const position = toMap( bounds, area.x, area.y ),
            outline = outlines[ name ] || [];
      let box = null,
          centre = position;

      // fit the region's outline; outline points are in hex pixels
      if ( outline.length )
      {
        const xs = outline.map( p => p[ 0 ] ),
              ys = outline.map( p => p[ 1 ] );
        box = { width: Math.max( ...xs ) - Math.min( ...xs ), height: Math.max( ...ys ) - Math.min( ...ys ) };
        centre = {
          x: bounds.x + ( Math.max( ...xs ) + Math.min( ...xs ) ) / 2,
          y: bounds.y + ( Math.max( ...ys ) + Math.min( ...ys ) ) / 2
        };
      }

      named[ hex ].push( { name, ...position } );
      places.push( withSearchText( { kind: 'area', name, hex, hexTitle: title, ...centre, box }, [ title ] ) );
    }

    for ( const label of data.labels || [] )
    {
      const position = toMap( bounds, label.x, label.y );
      // the data has some exact duplicates
      if ( named[ hex ].some( p => p.name === label.text && p.x === position.x && p.y === position.y ) ) continue;
      named[ hex ].push( { name: label.text, ...position } );
      places.push( withSearchText( { kind: 'location', name: label.text, hex, hexTitle: title, ...position }, [ title ] ) );
    }
  }
  return places;
};

/**
 * Name of the nearest named place in a hex.
 *
 * @param {string} hex Hex key.
 * @param {number} x   Map x.
 * @param {number} y   Map y.
 * @returns {string} Place name, or an empty string.
 */
const nearestPlace = ( hex, x, y ) =>
{
  let best = '',
      distance = Infinity;
  for ( const place of named[ hex ] || [] )
  {
    const d = ( place.x - x ) ** 2 + ( place.y - y ) ** 2;
    if ( d < distance )
    {
      distance = d;
      best = place.name;
    }
  }
  return best;
};

// structure index, rebuilt when the live data changes
let structures = [],
    structures_source = null;

/**
 * Build the structure index from the live world data: "Type – nearest place".
 *
 * @param {object} data World store value.
 * @returns {object[]} Structure entries.
 */
const getStructures = data =>
{
  if ( data === structures_source ) return structures;
  getPlaces();
  structures_source = data;
  structures = [];

  for ( const [ id, hexData ] of Object.entries( data ) )
  {
    // the API proxy keys hexes without "Hex"; MarbanHollow never had it
    const hex = grid.world[ id + 'Hex' ] ? id + 'Hex' : id;
    if ( !grid.world[ hex ] || !Array.isArray( hexData.d ) ) continue;

    const bounds = grid.bounds( hex ),
          title = grid.world[ hex ].title;

    for ( const item of hexData.d )
    {
      const type = icons.getName( item.i );
      if ( !type ) continue;

      const position = toMap( bounds, item.x, item.y ),
            location = nearestPlace( hex, position.x, position.y ) || title,
            team = icons.getTeam( item );

      structures.push( withSearchText( {
        kind: 'structure', name: `${ type } – ${ location }`, type, location, team, item,
        resource: icons.isResource( item.i ), hex, hexTitle: title, ...position
      }, [ title, team, ...icons.getAliases( item.i ) ] ) );
    }
  }
  return structures;
};

/**
 * Rank an entry for the query words: 0 best, 3 for no match.
 *
 * @param {object} entry   Search entry.
 * @param {string} query   Normalised query.
 * @param {string[]} parts Query words.
 * @returns {number} Rank.
 */
const rank = ( entry, query, parts ) =>
{
  if ( entry.key.startsWith( query ) ) return 0;
  if ( parts.every( part => entry.nameWords.some( word => word.startsWith( part ) ) ) ) return 1;
  if ( parts.every( part => entry.words.some( word => word.startsWith( part ) ) ) ) return 2;
  return 3;
};

/**
 * Find the best entries for a query.
 *
 * @param {string} text Query as typed.
 * @param {object} data World store value, for structures.
 * @returns {object[]} At most max_suggestions entries.
 */
const find = ( text, data ) =>
{
  const query = normalise( text );
  if ( query.length < min_query ) return [];

  const parts = query.split( ' ' ),
        matches = [];

  for ( const entry of [ ...getPlaces(), ...getStructures( data ) ] )
  {
    const r = rank( entry, query, parts );
    if ( r < 3 ) matches.push( { entry, r } );
  }

  matches.sort( ( a, b ) =>
    a.r - b.r
    || kinds[ a.entry.kind ].order - kinds[ b.entry.kind ].order
    // resource fields and mines repeat a lot; keep them below other structures
    || ( a.entry.resource ? 1 : 0 ) - ( b.entry.resource ? 1 : 0 )
    || a.entry.name.length - b.entry.name.length
    || a.entry.name.localeCompare( b.entry.name ) );

  return matches.slice( 0, max_suggestions ).map( match => match.entry );
};

/**
 * Stable id of an entry, used for recent searches and list keys.
 *
 * @param {object} entry Search entry.
 * @returns {string} Id.
 */
const entryId = entry =>
{
  const id = [ entry.kind, entry.hex, entry.name ];
  // several structures of one type can share the nearest place; their position tells them apart
  if ( entry.kind === 'structure' ) id.push( Math.round( entry.x ), Math.round( entry.y ) );
  return id.join( ':' );
};

/**
 * Read recent choices from localStorage.
 *
 * @returns {string[]} Entry ids, newest first.
 */
const readRecent = () =>
{
  try
  {
    const saved = JSON.parse( window.localStorage.getItem( recent_key ) );
    return Array.isArray( saved ) ? saved.filter( id => typeof id === 'string' ).slice( 0, max_recent ) : [];
  }
  catch
  {
    return [];
  }
};

/**
 * Save recent choices to localStorage.
 *
 * @param {string[]} ids Entry ids, newest first.
 * @returns {void}
 */
const saveRecent = ids =>
{
  try
  {
    window.localStorage.setItem( recent_key, JSON.stringify( ids ) );
  }
  catch
  {
    // storage can be unavailable (private mode); recent searches then last until reload
  }
};

const query = writable( '' ),
      open = writable( false ),
      active = writable( -1 ),
      recent = writable( typeof window === 'undefined' ? [] : readRecent() );

/**
 * What the list shows: suggestions for the query, or recent choices when the field is empty.
 * Structures in recent choices that no longer exist are left out.
 * @type {import('svelte/store').Readable<{ heading: string, entries: object[] }>}
 */
const list = derived( [ query, recent, world ], ( [ $query, $recent, $world ] ) =>
{
  if ( $query.trim() ) return { heading: '', entries: find( $query, $world ) };

  const all = [ ...getPlaces(), ...getStructures( $world ) ];
  const entries = $recent
    .map( id => all.find( entry => entryId( entry ) === id ) )
    .filter( Boolean );
  return { heading: entries.length ? 'Recent' : '', entries };
} );

/**
 * Remember a chosen entry at the top of the recent list.
 *
 * @param {object} entry Search entry.
 * @returns {void}
 */
const remember = entry =>
{
  const id = entryId( entry ),
        ids = [ id, ...get( recent ).filter( other => other !== id ) ].slice( 0, max_recent );
  recent.set( ids );
  saveRecent( ids );
};

export const search = {

  /**
   * Nearest named place of a map item and its hex, such as "The Plaza, Dead Lands".
   *
   * @param {string} hex  Hex key in the world data.
   * @param {object} item Map item ({ x, y } as fractions of the hex).
   * @returns {string} Place and hex title, or an empty string for an unknown hex.
   */
  placeOf( hex, item )
  {
    getPlaces();
    const bounds = grid.bounds( hex );
    if ( !bounds ) return '';

    const position = toMap( bounds, item.x, item.y ),
          title = grid.world[ hex ].title,
          place = nearestPlace( hex, position.x, position.y );
    return place ? `${ place }, ${ title }` : title;
  },

  query: { subscribe: query.subscribe },
  open: { subscribe: open.subscribe },
  active: { subscribe: active.subscribe },
  list: { subscribe: list.subscribe },
  kinds,
  entryId,

  /**
   * Update the query and open the list.
   *
   * @param {string} text Field contents.
   * @returns {void}
   */
  setQuery( text )
  {
    query.set( text );
    active.set( -1 );
    open.set( true );
  },

  /**
   * Show or hide the list.
   *
   * @param {boolean} value Whether the list is open.
   * @returns {void}
   */
  setOpen( value )
  {
    open.set( value );
    if ( !value ) active.set( -1 );
  },

  /**
   * Move the highlight through the list, wrapping at both ends.
   *
   * @param {number} step 1 for down, -1 for up.
   * @returns {void}
   */
  move( step )
  {
    const count = get( list ).entries.length;
    if ( !count ) return;
    open.set( true );
    active.update( index =>
    {
      // nothing highlighted yet: down starts at the top, up at the bottom
      if ( index < 0 ) return step > 0 ? 0 : count - 1;
      return ( index + step + count ) % count;
    } );
  },

  /**
   * Choose the highlighted entry, or the first one when none is highlighted.
   *
   * @returns {boolean} Whether something was chosen.
   */
  chooseActive()
  {
    const entries = get( list ).entries;
    if ( !entries.length ) return false;
    this.choose( entries[ Math.max( 0, get( active ) ) ] );
    return true;
  },

  /**
   * Move the map to an entry, show its name in the field, and remember it.
   *
   * @param {object} entry Search entry.
   * @returns {void}
   */
  choose( entry )
  {
    const target = { x: entry.x, y: entry.y };
    if ( entry.box ) target.box = entry.box;
    else target.scale = entry.kind === 'area' ? region_scale : point_scale;
    view.focus( target );

    query.set( entry.name );
    open.set( false );
    active.set( -1 );
    remember( entry );
  },

  /**
   * Remove an entry from the recent list.
   *
   * @param {object} entry Search entry.
   * @returns {void}
   */
  forget( entry )
  {
    const ids = get( recent ).filter( id => id !== entryId( entry ) );
    recent.set( ids );
    saveRecent( ids );
  },

  /**
   * Empty the field and close the list.
   *
   * @returns {void}
   */
  clear()
  {
    query.set( '' );
    open.set( false );
    active.set( -1 );
  }
};
