import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import path from 'path';

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

export default defineConfig( {
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
