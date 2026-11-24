<script lang="ts">
	import { onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import { Button } from '$lib/components/ui/button';
	import { sanitizeHref } from '$lib/email/sanitize';

	let {
		html = $bindable(''),
		onReady
	}: {
		html?: string;
		onReady?: (insert: (token: string) => void) => void;
	} = $props();

	let host: HTMLDivElement | undefined = $state();
	let editor = $state<Editor | null>(null);
	let seeded = $state(false);

	$effect(() => {
		if (!editor || seeded || !html) return;
		seeded = true;
		if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
	});

	onMount(() => {
		let dead = false;
		let current: Editor | null = null;
		void (async () => {
			const [{ Editor: TipTap }, { default: StarterKit }, { default: Link }] = await Promise.all([
				import('@tiptap/core'),
				import('@tiptap/starter-kit'),
				import('@tiptap/extension-link')
			]);
			if (dead || !host) return;
			const EmailLink = Link.extend({
				addAttributes() {
					return {
						...this.parent?.(),
						class: {
							default: null,
							parseHTML: (element: HTMLElement) =>
								element.classList.contains('ppp-email-button') ? 'ppp-email-button' : null,
							renderHTML: (attributes: { class?: string | null }) =>
								attributes.class === 'ppp-email-button' ? { class: 'ppp-email-button' } : {}
						}
					};
				}
			});
			current = new TipTap({
				element: host,
				extensions: [
					StarterKit.configure({ heading: { levels: [2] } }),
					EmailLink.configure({ openOnClick: false, autolink: false })
				],
				content: html || '<p></p>',
				onUpdate: ({ editor: next }) => {
					html = next.getHTML();
				}
			});
			editor = current;
			onReady?.((token) => {
				current?.chain().focus().insertContent(token).run();
			});
		})();
		return () => {
			dead = true;
			current?.destroy();
			editor = null;
		};
	});

	function run(command: (ed: Editor) => void) {
		if (editor) command(editor);
	}

	function addLink(button: boolean) {
		if (!editor) return;
		const href = sanitizeHref(window.prompt('Link address', 'https://') ?? '');
		if (!href) return;
		const label = button ? 'Button' : 'link';
		const classAttr = button ? ' class="ppp-email-button"' : '';
		editor
			.chain()
			.focus()
			.insertContent(`<a href="${href}"${classAttr}>${label}</a>`)
			.run();
	}
</script>

<div class="flex flex-wrap gap-1">
	<Button type="button" variant="outline" size="sm" onclick={() => run((ed) => ed.chain().focus().toggleBold().run())}>Bold</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => run((ed) => ed.chain().focus().toggleItalic().run())}>Italic</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => run((ed) => ed.chain().focus().toggleHeading({ level: 2 }).run())}>Heading</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => run((ed) => ed.chain().focus().toggleBulletList().run())}>List</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => addLink(false)}>Link</Button>
	<Button type="button" variant="outline" size="sm" onclick={() => addLink(true)}>Button</Button>
</div>
<div bind:this={host} class="email-body-editor mt-2 rounded-md border border-input bg-background"></div>
