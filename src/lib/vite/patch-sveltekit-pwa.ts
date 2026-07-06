import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin, PluginOption } from 'vite';

const SW_REL = '.svelte-kit/output/client/service-worker.js';

async function serviceWorkerBuilt(root: string): Promise<boolean> {
	try {
		await access(join(root, SW_REL));
		return true;
	} catch {
		return false;
	}
}

/**
 * @vite-pwa/sveltekit runs injectManifest on SSR closeBundle. SvelteKit's nested
 * client/SW builds can fire that hook before `service-worker.js` exists (Vite 7).
 * Skip injectManifest until Kit has emitted the file; the final SSR closeBundle runs it.
 */
export function patchSvelteKitPwaPlugins(plugins: PluginOption[]): PluginOption[] {
	// @ts-expect-error Vite PluginOption[] flat(Infinity) — excessively deep instantiation (upstream types)
	const flat = plugins.flat(Infinity);

	for (const plugin of flat) {
		if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) continue;
		if (plugin.name !== 'vite-plugin-pwa:sveltekit:build') continue;

		const closeBundle = plugin.closeBundle;
		if (!closeBundle || typeof closeBundle !== 'object' || !('handler' in closeBundle)) continue;

		const original = closeBundle.handler.bind(plugin);
		closeBundle.handler = async function patchedCloseBundle(
			this: unknown,
			...args: Parameters<typeof original>
		) {
			const root = process.cwd();
			if (!(await serviceWorkerBuilt(root))) return;
			return original.apply(this, args);
		};
	}

	return flat;
}
