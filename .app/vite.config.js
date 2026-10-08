import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Server that answers /api and /assets during development: the PHP development server
 * (npm run api) by default, or any deployed copy of the site through FATT_SERVER.
 * @type {string}
 */
const server = process.env.FATT_SERVER || 'http://127.0.0.1:8090';

/**
 * Paths that live outside the app and are forwarded to that server.
 * @type {Record<string, object>}
 */
const proxy = {
  '/api': { target: server, changeOrigin: true },
  '/assets': { target: server, changeOrigin: true },
  '/favicon.png': { target: server, changeOrigin: true }
};

/**
 * Files whose content makes up the assets version: the map tiles in use (.webp) and the icons.
 * @type {{ dir: string, ext: string }[]}
 */
const versioned = [
  { dir: path.resolve( '../assets/maps' ), ext: '.webp' },
  { dir: path.resolve( '../assets/icons' ), ext: '.png' }
];

/**
 * Hash of the map tiles and icons, added to their urls as ?v=: their names stay the same when
 * they change, and the server lets browsers cache images for a week.
 *
 * @returns {string} Short content hash.
 */
const assetsVersion = () =>
{
  const hash = crypto.createHash( 'md5' );
  for ( const { dir, ext } of versioned )
  {
    const files = fs.readdirSync( dir, { recursive: true } )
      .map( String )
      .filter( file => file.endsWith( ext ) )
      .sort();
    for ( const file of files )
    {
      hash.update( file );
      hash.update( fs.readFileSync( path.join( dir, file ) ) );
    }
  }
  return hash.digest( 'hex' ).slice( 0, 10 );
};

export default defineConfig( {
  define: {
    'import.meta.env.ASSETS_VERSION': JSON.stringify( assetsVersion() )
  },
  plugins: [
    sveltekit( {
      // single page app; every route falls back to index.html. The build goes to .app/build,
      // scripts/publish.js then copies it to the web root.
      adapter: adapter( {
        fallback: 'index.html'
      } ),
      prerender: { entries: [] }
    } )
  ],
  server: { proxy },
  preview: { proxy },
  resolve: {
    alias: {
      '@components': path.resolve( './src/components' ),
      '@stores': path.resolve( './src/stores' ),
      '@lib': path.resolve( './src/lib' )
    }
  }
} );
