import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path'
const config = {
	plugins: [
    sveltekit()  
  ],
  resolve: {
    alias: {
      '@components': path.resolve('./src/components'),
      '@stores': path.resolve('./src/stores'),
    }
  }
}

export default config;
