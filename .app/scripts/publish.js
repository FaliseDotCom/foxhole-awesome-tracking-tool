import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Copy the static build into the web root (the repository root). Only index.html and _app/
 * are replaced; assets/, .api/ and everything else in the web root is left alone.
 */

/**
 * The app folder (.app).
 * @type {string}
 */
const app = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );

/**
 * Build output of adapter-static.
 * @type {string}
 */
const build = path.join( app, 'build' );

/**
 * The web root.
 * @type {string}
 */
const root = path.resolve( app, '..' );

/**
 * Build entries that are published.
 * @type {string[]}
 */
const entries = [ 'index.html', '_app' ];

for ( const entry of entries )
{
  const from = path.join( build, entry );
  if ( !fs.existsSync( from ) )
  {
    throw new Error( `Build output is missing ${ entry }; run vite build first` );
  }
}

for ( const entry of entries )
{
  const to = path.join( root, entry );
  // remove the previous build so stale hashed chunks do not pile up
  fs.rmSync( to, { recursive: true, force: true } );
  fs.cpSync( path.join( build, entry ), to, { recursive: true } );
}

/**
 * Build version from SvelteKit (a timestamp), used as a cache buster for the stylesheets in
 * assets/css: their names stay the same between builds, so every build gets a new ?v=.
 * @type {string}
 */
const version = JSON.parse( fs.readFileSync( path.join( build, '_app', 'version.json' ), 'utf8' ) ).version;

const page = path.join( root, 'index.html' );
fs.writeFileSync( page, fs.readFileSync( page, 'utf8' )
  .replace( /(href="\/assets\/css\/[^"?]+\.css)"/g, `$1?v=${ version }"` ) );

console.info( `Published ${ entries.join( ', ' ) } to ${ root }` );
