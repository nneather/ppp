<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { matchPublisher } from '$lib/library/match';
	import { publisherDefaultLocationForRow } from '$lib/library/publisher-resolve';
	import type { PublisherRow } from '$lib/types/library';

	export type BookPublicationFields = {
		publisher: string;
		publisher_location: string;
		publisher_id: string;
		year: string;
		edition: string;
		total_volumes: string;
		original_year: string;
		reprint_publisher: string;
		reprint_publisher_id: string;
		reprint_location: string;
		reprint_year: string;
		page_count: string;
		isbn: string;
		shelving_location: string;
	};

	let {
		pub = $bindable(),
		variant,
		publishers,
		disabled = false
	}: {
		pub: BookPublicationFields;
		variant: 'essentials' | 'extended';
		publishers: PublisherRow[];
		disabled?: boolean;
	} = $props();

	const publisherSelectItems = $derived([
		{ value: '', label: '— Custom / not listed —' },
		...publishers.map((p) => ({
			value: p.id,
			label: p.canonical_name
		}))
	]);

	const reprintPublisherSelectItems = $derived(publisherSelectItems);

	function applyPublisherPick(id: string, target: 'primary' | 'reprint') {
		if (!id) {
			if (target === 'primary') pub.publisher_id = '';
			else pub.reprint_publisher_id = '';
			return;
		}
		const row = publishers.find((p) => p.id === id);
		if (!row) return;
		if (target === 'primary') {
			pub.publisher_id = id;
			pub.publisher = row.canonical_name;
			if (!pub.publisher_location.trim()) {
				pub.publisher_location = publisherDefaultLocationForRow(row) ?? '';
			}
		} else {
			pub.reprint_publisher_id = id;
			pub.reprint_publisher = row.canonical_name;
		}
	}
</script>

{#if variant === 'essentials'}
	<div class="space-y-2 sm:col-span-2">
		<Label for="bf-pub">Publisher</Label>
		<Input
			id="bf-pub"
			name="publisher"
			bind:value={pub.publisher}
			class="h-11 text-base"
			{disabled}
			oninput={() => {
				if (pub.publisher_id) {
					const row = publishers.find((p) => p.id === pub.publisher_id);
					if (row && pub.publisher.trim() !== row.canonical_name) pub.publisher_id = '';
				}
			}}
			onblur={() => {
				const matched = pub.publisher.trim() ? matchPublisher(pub.publisher, publishers) : null;
				if (matched) applyPublisherPick(matched.id, 'primary');
			}}
		/>
		<Select.Root
			type="single"
			value={pub.publisher_id}
			onValueChange={(v) => applyPublisherPick(v ?? '', 'primary')}
			items={publisherSelectItems}
		>
			<Select.Trigger class="mt-1.5 h-9 w-full justify-between px-3 text-xs" {disabled}>
				<span class="truncate text-left text-muted-foreground">
					{pub.publisher_id
						? (publishers.find((p) => p.id === pub.publisher_id)?.canonical_name ??
							'Registry imprint')
						: 'Pick from publishers list…'}
				</span>
			</Select.Trigger>
			<Select.Content class="max-h-72">
				{#each publisherSelectItems as item (item.value)}
					<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		{#if pub.publisher.trim() && !pub.publisher_id}
			<p class="text-xs text-muted-foreground">
				Not in publishers list —
				<a
					href="/settings/library/publishers"
					class="underline underline-offset-2"
					target="_blank"
					rel="noopener noreferrer">add in settings</a
				>
				for consistent citations.
			</p>
		{/if}
		<input type="hidden" name="publisher_id" value={pub.publisher_id} />
	</div>
	<div class="space-y-2">
		<Label for="bf-pub-loc">Publisher location</Label>
		<Input
			id="bf-pub-loc"
			name="publisher_location"
			bind:value={pub.publisher_location}
			class="h-11 text-base"
			{disabled}
		/>
	</div>
	<div class="space-y-2">
		<Label for="bf-year">Year</Label>
		<Input
			id="bf-year"
			name="year"
			type="number"
			inputmode="numeric"
			bind:value={pub.year}
			class="h-11 text-base tabular-nums"
			{disabled}
		/>
	</div>
{:else}
	<!-- Publication -->
	<section class="flex flex-col gap-4">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Publication
		</h3>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<Label for="bf-edition">Edition</Label>
				<Input
					id="bf-edition"
					name="edition"
					bind:value={pub.edition}
					class="h-11 text-base"
					{disabled}
				/>
			</div>
			<div class="space-y-2">
				<Label for="bf-volumes">Total volumes</Label>
				<Input
					id="bf-volumes"
					name="total_volumes"
					type="number"
					inputmode="numeric"
					bind:value={pub.total_volumes}
					class="h-11 text-base tabular-nums"
					{disabled}
				/>
			</div>
			<div class="space-y-2">
				<Label for="bf-pages">Page count</Label>
				<Input
					id="bf-pages"
					name="page_count"
					type="number"
					inputmode="numeric"
					bind:value={pub.page_count}
					class="h-11 text-base tabular-nums"
					{disabled}
				/>
			</div>
		</div>
	</section>

	<!-- Reprint -->
	<section class="flex flex-col gap-4">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Reprint (optional)
		</h3>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<Label for="bf-orig-year">Original year</Label>
				<Input
					id="bf-orig-year"
					name="original_year"
					type="number"
					inputmode="numeric"
					bind:value={pub.original_year}
					class="h-11 text-base tabular-nums"
					{disabled}
				/>
			</div>
			<div class="space-y-2">
				<Label for="bf-rep-year">Reprint year</Label>
				<Input
					id="bf-rep-year"
					name="reprint_year"
					type="number"
					inputmode="numeric"
					bind:value={pub.reprint_year}
					class="h-11 text-base tabular-nums"
					{disabled}
				/>
			</div>
			<div class="space-y-2 sm:col-span-2">
				<Label for="bf-rep-pub">Reprint publisher</Label>
				<Input
					id="bf-rep-pub"
					name="reprint_publisher"
					bind:value={pub.reprint_publisher}
					class="h-11 text-base"
					{disabled}
					oninput={() => {
						if (pub.reprint_publisher_id) {
							const row = publishers.find((p) => p.id === pub.reprint_publisher_id);
							if (row && pub.reprint_publisher.trim() !== row.canonical_name) {
								pub.reprint_publisher_id = '';
							}
						}
					}}
				/>
				<Select.Root
					type="single"
					value={pub.reprint_publisher_id}
					onValueChange={(v) => applyPublisherPick(v ?? '', 'reprint')}
					items={reprintPublisherSelectItems}
				>
					<Select.Trigger class="mt-1.5 h-9 w-full justify-between px-3 text-xs" {disabled}>
						<span class="truncate text-left text-muted-foreground">
							{pub.reprint_publisher_id
								? (publishers.find((p) => p.id === pub.reprint_publisher_id)?.canonical_name ??
									'Registry imprint')
								: 'Pick from publishers list…'}
						</span>
					</Select.Trigger>
					<Select.Content class="max-h-72">
						{#each reprintPublisherSelectItems as item (item.value)}
							<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="reprint_publisher_id" value={pub.reprint_publisher_id} />
			</div>
			<div class="space-y-2">
				<Label for="bf-rep-loc">Reprint location</Label>
				<Input
					id="bf-rep-loc"
					name="reprint_location"
					bind:value={pub.reprint_location}
					class="h-11 text-base"
					{disabled}
				/>
			</div>
		</div>
	</section>

	<!-- Identifiers + shelf -->
	<section class="flex flex-col gap-4">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Identifiers & shelf
		</h3>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2 sm:col-span-2">
				<Label for="bf-isbn">ISBN</Label>
				<Input
					id="bf-isbn"
					name="isbn"
					bind:value={pub.isbn}
					class="h-11 text-base tabular-nums"
					{disabled}
				/>
			</div>
			<div class="space-y-2 sm:col-span-2">
				<Label for="bf-shelving">Shelving location</Label>
				<Input
					id="bf-shelving"
					name="shelving_location"
					bind:value={pub.shelving_location}
					placeholder="e.g. Office, top shelf"
					class="h-11 text-base"
					{disabled}
				/>
			</div>
		</div>
	</section>
{/if}
