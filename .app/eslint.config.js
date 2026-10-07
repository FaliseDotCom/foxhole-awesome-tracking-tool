import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';

export default defineConfig( [
  {
    ignores: [ 'build/', '.svelte-kit/', 'test-results/', 'playwright-report/' ]
  },
  js.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
] );
