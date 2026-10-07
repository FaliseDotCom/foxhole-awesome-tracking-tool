import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import TGA from 'tga';
import { Delaunay } from 'd3-delaunay';

/**
 * Rebuild the static world data and hex background images from the War API.
 *
 *   node scripts/build-hexes.js            update world_data.json and assets/maps/classic
 *   node scripts/build-hexes.js --dry-run  only report what would change
 *
 * For every hex the War API lists, it takes the region id, region names and label positions
 * from the static map endpoint, the grid position from LAYOUT below, and the background image
 * from the War API repository. Region outlines drawn by hand are kept when a hex still has
 * exactly the same regions; otherwise the hex gets generated outlines (a Voronoi diagram of its
 * region labels) to correct with the points tool.
 */

const app = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const root = path.resolve( app, '..' );
const world_file = path.join( app, 'src/stores/world_data.json' );
const maps_dir = path.join( root, 'assets/maps/classic' );
const cache_dir = path.join( os.tmpdir(), 'fatt-hexes' );
const dry_run = process.argv.includes( '--dry-run' );

const war_api = 'https://war-service-live.foxholeservices.com/api/worldconquest/';
const images_api = 'https://api.github.com/repos/clapfoot/warapi/contents/Images/Maps';

// hex size in map pixels, as in stores/grid.js
const hex_width = 1024;
const hex_height = 888;

/**
 * Hex positions in axial coordinates (q, p), from notbadjon/foxhole-hexes (MIT licence),
 * checked against the 29 hexes whose 2022 position did not change. Grid position:
 * col = p + 6, row = p + 2q + 6, which puts the world in columns 0–12 and rows 0–12.
 */
const LAYOUT = {
  BasinSionnachHex: [ -3, 0 ], HowlCountyHex: [ -3, 1 ], ClansheadValleyHex: [ -3, 2 ],
  MorgensCrossingHex: [ -3, 3 ], GodcroftsHex: [ -3, 4 ], LykosIsleHex: [ -3, 5 ],
  SpeakingWoodsHex: [ -2, -1 ], ReachingTrailHex: [ -2, 0 ], ViperPitHex: [ -2, 1 ],
  WeatheredExpanseHex: [ -2, 2 ], StlicanShelfHex: [ -2, 3 ], TempestIslandHex: [ -2, 4 ],
  TheFingersHex: [ -2, 5 ], PipersEnclaveHex: [ -2, 6 ],
  CallumsCapeHex: [ -1, -2 ], MooringCountyHex: [ -1, -1 ], CallahansPassageHex: [ -1, 0 ],
  MarbanHollow: [ -1, 1 ], ClahstraHex: [ -1, 2 ], EndlessShoreHex: [ -1, 3 ],
  WrestaHex: [ -1, 4 ], TyrantFoothillsHex: [ -1, 5 ],
  KuuraStrandHex: [ 0, -4 ], NevishLineHex: [ 0, -3 ], StonecradleHex: [ 0, -2 ],
  LinnMercyHex: [ 0, -1 ], DeadLandsHex: [ 0, 0 ], DrownedValeHex: [ 0, 1 ],
  AllodsBightHex: [ 0, 2 ], ReaversPassHex: [ 0, 3 ], OnyxHex: [ 0, 4 ],
  PariPeakHex: [ 1, -5 ], GutterHex: [ 1, -4 ], FarranacCoastHex: [ 1, -3 ],
  KingsCageHex: [ 1, -2 ], LochMorHex: [ 1, -1 ], UmbralWildwoodHex: [ 1, 0 ],
  ShackledChasmHex: [ 1, 1 ], TerminusHex: [ 1, 2 ],
  OlavisWakeHex: [ 2, -6 ], PalantineBermHex: [ 2, -5 ], FishermansRowHex: [ 2, -4 ],
  WestgateHex: [ 2, -3 ], SableportHex: [ 2, -2 ], HeartlandsHex: [ 2, -1 ],
  GreatMarchHex: [ 2, 0 ], AcrithiaHex: [ 2, 1 ],
  OarbreakerHex: [ 3, -5 ], StemaLandingHex: [ 3, -4 ], OriginHex: [ 3, -3 ],
  AshFieldsHex: [ 3, -2 ], RedRiverHex: [ 3, -1 ], KalokaiHex: [ 3, 0 ]
};

/**
 * Fetch a url as JSON.
 *
 * @param {string} url Address to fetch.
 * @returns {Promise<any>} Parsed response.
 */
const getJson = async url =>
{
  const response = await fetch( url, { headers: { 'User-Agent': 'fatt-build-hexes' } } );
  if ( !response.ok ) throw new Error( `${ response.status } for ${ url }` );
  return response.json();
};

/**
 * Round to two decimals, the precision world_data.json uses.
 *
 * @param {number} value Number to round.
 * @returns {number} Rounded number.
 */
const round = value => Math.round( value * 100 ) / 100;

/**
 * Turn a hex name into a title: "KingsCageHex" becomes "Kings Cage".
 *
 * @param {string} hex Hex name from the War API.
 * @returns {string} Title with spaces.
 */
const toTitle = hex => hex.replace( /Hex$/, '' ).replace( /([a-z])([A-Z])/g, '$1 $2' );

/**
 * Name of a point by index: a … z, then aa, ab …
 *
 * @param {number} index Zero-based point number.
 * @returns {string} Point name.
 */
const pointName = index =>
{
  let name = '';
  let n = index;
  do
  {
    name = String.fromCharCode( 97 + ( n % 26 ) ) + name;
    n = Math.floor( n / 26 ) - 1;
  }
  while ( n >= 0 );
  return name;
};

/**
 * Generate region outlines: a Voronoi diagram of the region label positions, clipped to the
 * hex's bounding box (the map draws hexes through a hexagon clip path).
 *
 * @param {{ text: string, x: number, y: number }[]} majors Region labels, positions 0–1.
 * @returns {{ points: Record<string, string>, outlines: Record<string, string> }} Named points
 *   ("x y" in fractions) and, per region, the names of its corner points.
 */
const generateOutlines = majors =>
{
  const seeds = majors.map( m => [ m.x * hex_width, m.y * hex_height ] );
  const voronoi = Delaunay.from( seeds ).voronoi( [ 0, 0, hex_width, hex_height ] );
  const points = {};
  const names = new Map();
  const outlines = {};

  majors.forEach( ( major, index ) =>
  {
    const cell = voronoi.cellPolygon( index ) || [];
    const corners = cell.slice( 0, -1 ).map( ( [ x, y ] ) =>
    {
      const value = `${ round( x / hex_width ) } ${ round( y / hex_height ) }`;
      if ( !names.has( value ) )
      {
        const name = pointName( names.size );
        names.set( value, name );
        points[ name ] = value;
      }
      return names.get( value );
    } );
    // neighbouring corners can round to the same point
    outlines[ major.text ] = corners.filter( ( name, i ) => name !== corners[ i - 1 ] ).join( ' ' );
  } );

  return { points, outlines };
};

/**
 * Compare region names ignoring case and punctuation, so a spelling fix such as
 * "GoldenRoot Ranch" → "Goldenroot Ranch" still matches.
 *
 * @param {string} name Region name.
 * @returns {string} Lower-case letters and digits only.
 */
const nameKey = name => name.toLowerCase().replace( /[^a-z0-9]/g, '' );

/**
 * Find the current entry of a region by name, ignoring case and punctuation.
 *
 * @param {object|undefined} existing Current world_data.json entry of the hex.
 * @param {string} name Region name from the War API.
 * @returns {object|null} The region's x, y and points, or null.
 */
const findArea = ( existing, name ) =>
{
  if ( !existing || !existing.areas ) return null;
  const key = Object.keys( existing.areas ).find( current => nameKey( current ) === nameKey( name ) );
  return key ? existing.areas[ key ] : null;
};

/**
 * Whether a hex has hand-drawn outlines for exactly these regions.
 *
 * @param {object|undefined} existing Current world_data.json entry.
 * @param {string[]} names Region names from the War API.
 * @returns {boolean} True when the outlines can be kept.
 */
const hasMatchingOutlines = ( existing, names ) =>
{
  if ( !existing || !existing.areas ) return false;
  return Object.keys( existing.areas ).length === names.length
    && names.every( name => findArea( existing, name )?.points );
};

/**
 * Download (once, cached in the temp folder) and convert a hex background image.
 *
 * @param {string} hex Hex name from the War API.
 * @param {Map<string, string>} images Lower-case image file name to download url.
 * @returns {Promise<string>} Result for the report.
 */
const buildImage = async ( hex, images ) =>
{
  const file = `map${ hex.replace( /Hex$/, '' ).toLowerCase() }hex.tga`;
  const url = images.get( file );
  if ( !url ) return 'no image';

  const cached = path.join( cache_dir, file );
  if ( !fs.existsSync( cached ) )
  {
    const response = await fetch( url );
    if ( !response.ok ) return `image download failed (${ response.status })`;
    fs.writeFileSync( cached, Buffer.from( await response.arrayBuffer() ) );
  }
  if ( dry_run ) return 'image ok';

  const tga = new TGA( fs.readFileSync( cached ) );
  const target = path.join( maps_dir, hex.toLowerCase().replace( 'hex', '' ).replace( 'map', '' ) + '.webp' );
  await sharp( Buffer.from( tga.pixels ), { raw: { width: tga.width, height: tga.height, channels: 4 } } )
    .resize( hex_width, hex_height )
    .webp( { quality: 80 } )
    .toFile( target );
  return 'image written';
};

const main = async () =>
{
  fs.mkdirSync( cache_dir, { recursive: true } );
  const world = JSON.parse( fs.readFileSync( world_file, 'utf8' ) );
  const maps = await getJson( war_api + 'maps' );
  const listing = await getJson( images_api );
  const images = new Map( listing.map( item => [ item.name.toLowerCase(), item.download_url ] ) );

  const missing = maps.filter( hex => !LAYOUT[ hex ] );
  if ( missing.length ) throw new Error( 'No grid position for ' + missing.join( ', ' ) );

  const result = {};
  for ( const hex of maps )
  {
    const data = await getJson( `${ war_api }maps/${ hex }/static` );
    const existing = world[ hex ];
    const [ q, p ] = LAYOUT[ hex ];

    // region labels, without duplicates
    const majors = [];
    data.mapTextItems.filter( t => t.mapMarkerType === 'Major' ).forEach( t =>
    {
      if ( !majors.some( m => m.text === t.text ) ) majors.push( { text: t.text, x: round( t.x ), y: round( t.y ) } );
    } );

    // other labels, without exact duplicates
    const labels = [];
    data.mapTextItems.filter( t => t.mapMarkerType !== 'Major' ).forEach( t =>
    {
      const label = { x: round( t.x ), y: round( t.y ), text: t.text };
      if ( !labels.some( l => l.text === label.text && l.x === label.x && l.y === label.y ) ) labels.push( label );
    } );

    const names = majors.map( m => m.text );
    const keep = hasMatchingOutlines( existing, names );
    const generated = keep ? null : generateOutlines( majors );

    const areas = {};
    majors.forEach( major =>
    {
      const current = keep ? findArea( existing, major.text ) : null;
      areas[ major.text ] = {
        // keep label positions that were moved by hand to avoid overlap
        x: current ? current.x : major.x,
        y: current ? current.y : major.y,
        points: current ? current.points : generated.outlines[ major.text ]
      };
    } );

    result[ hex ] = {
      id: data.regionId,
      hex,
      name: hex.replace( /Hex$/, '' ),
      title: existing ? existing.title : toTitle( hex ),
      col: p + 6,
      row: p + 2 * q + 6,
      points: keep ? existing.points : generated.points,
      areas,
      labels
    };

    const image = await buildImage( hex, images );
    console.info( [
      hex.padEnd( 22 ),
      existing ? 'existing' : 'new     ',
      keep ? 'outlines kept     ' : 'outlines generated',
      `${ majors.length } regions`,
      image
    ].join( '  ' ) );
  }

  if ( dry_run ) return;
  fs.writeFileSync( world_file, JSON.stringify( result, null, 2 ) + '\n' );
  console.info( `Wrote ${ Object.keys( result ).length } hexes to ${ world_file }` );
};

main().catch( error =>
{
  console.error( error );
  process.exit( 1 );
} );
