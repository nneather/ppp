<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { cn } from '$lib/utils.js';

	let {
		back,
		title,
		subtitle,
		titlePlaceholder = false,
		titleAfter,
		eyebrow,
		lead,
		meta,
		actions,
		class: className = ''
	}: {
		back?: { href: string; label: string };
		title: string;
		subtitle?: string;
		/** When true, `title` renders as muted italic (e.g. untitled placeholder). */
		titlePlaceholder?: boolean;
		/** Inline after the title (e.g. `, vol. N` on book detail). */
		titleAfter?: Snippet;
		eyebrow?: Snippet;
		/** Shown beside the title (e.g. Library list icon + heading). */
		lead?: Snippet;
		meta?: Snippet;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<header class={cn('w-full min-w-0', className)}>
	{#if back}
		<a
			href={back.href}
			class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="size-4 shrink-0" />
			{back.label}
		</a>
	{/if}

	<div
		class={cn(
			'flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between',
			back ? 'mt-4' : ''
		)}
	>
		<div class="min-w-0 flex-1">
			{#if eyebrow}
				<div class="flex flex-wrap items-center gap-2 text-muted-foreground">
					{@render eyebrow()}
				</div>
			{/if}

			<div
				class={cn(
					'flex min-w-0 items-center gap-2',
					eyebrow ? 'mt-1' : lead ? '' : ''
				)}
			>
				{#if lead}
					<div class="shrink-0 text-muted-foreground">
						{@render lead()}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<h1
						class="text-2xl font-semibold tracking-tight text-foreground break-words hyphens-auto leading-tight sm:text-3xl"
					>
						{#if titlePlaceholder}
							<span class="italic text-muted-foreground">{title}</span>
						{:else}
							{title}
						{/if}
						{#if titleAfter}
							{@render titleAfter()}
						{/if}
					</h1>
					{#if subtitle}
						<p class="mt-1 text-base text-muted-foreground">{subtitle}</p>
					{/if}
				</div>
			</div>

			{#if meta}
				<div class="mt-2 min-w-0">
					{@render meta()}
				</div>
			{/if}
		</div>

		{#if actions}
			<div
				class="flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-start md:justify-end"
			>
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
