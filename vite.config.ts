import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { patchSvelteKitPwaPlugins } from './src/lib/vite/patch-sveltekit-pwa';

const VIZ = process.env.PPP_BUNDLE_VIZ === '1';

function resolveAppBuild(): string {
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return new Date().toISOString().slice(0, 10);
	}
}

const APP_BUILD = resolveAppBuild();

const pwaPlugins = patchSvelteKitPwaPlugins([
	SvelteKitPWA({
		strategies: 'injectManifest',
		srcDir: 'src',
		filename: 'service-worker',
		registerType: 'prompt',
		manifest: false,
		devOptions: {
			enabled: false
		},
		injectManifest: {
			globPatterns: ['client/**/*.{js,css,ico,svg,webp,woff,woff2}', 'client/offline.html'],
			globIgnores: [
				'client/manifest.webmanifest',
				'client/icon-*.png',
				'client/apple-touch-icon.png'
			]
		}
	})
]);

export default defineConfig(() => ({
	define: {
		'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"',
		__APP_BUILD__: JSON.stringify(APP_BUILD)
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		...pwaPlugins,
		...(VIZ
			? [
					visualizer({
						filename: '.bundle-viz/treemap.html',
						template: 'treemap',
						gzipSize: true,
						brotliSize: true,
						emitFile: false
					})
				]
			: [])
	],
	test: {
		include: ['src/**/*.test.ts']
	},
	build: {
		rollupOptions: {
			output: {
				// Object manualChunks breaks SSR/nested Kit builds (externals). Function skips absent ids.
				manualChunks(id) {
					if (id.includes('node_modules/@supabase/')) return 'supabase';
					if (id.includes('node_modules/@lucide/svelte')) return 'lucide';
				}
			}
		}
	}
}));
