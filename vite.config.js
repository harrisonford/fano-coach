import { sveltekit } from '@sveltejs/kit/vite';
import tailwind from '@tailwindcss/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit(), tailwind()]
};

export default config;
