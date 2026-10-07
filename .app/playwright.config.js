import { defineConfig } from '@playwright/test';

export default defineConfig( {
  testDir: 'src/tests',
  testMatch: '**/*.test.js',
  // build and publish to the web root, then serve the whole site the way .htaccess does
  webServer: {
    command: 'npm run build && cd .. && php -S 127.0.0.1:8090 .api/router.php',
    url: 'http://127.0.0.1:8090/',
    // reuse a server that is already running locally
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  use: {
    baseURL: 'http://127.0.0.1:8090'
  }
} );
