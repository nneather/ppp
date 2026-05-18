import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

const VIZ = process.env.PPP_BUNDLE_VIZ === '1';

export default defineConfig({
	define: {
		'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"'
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			registerType: 'prompt',
			manifest: false,
			devOptions: {
				enabled: false
			},
			injectManifest: {
				globPatterns: ['client/**/*.{js,css,ico,svg,webp,woff,woff2}'],
				globIgnores: [
					'client/manifest.webmanifest',
					'client/icon-*.png',
					'client/apple-touch-icon.png'
				]
			}
		}),
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
	}
});
