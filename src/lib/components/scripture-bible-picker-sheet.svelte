<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		open = $bindable(false),
		title = 'Choose Bible book',
		bibleFilter = $bindable(''),
		suggestions = [],
		filteredNames = [],
		onPick
	}: {
		open?: boolean;
		title?: string;
		bibleFilter?: string;
		suggestions?: string[];
		filteredNames?: string[];
		onPick: (name: string) => void;
	} = $props();
</script>

<Sheet.Root bind:open={open}>
	<Sheet.Content side="bottom" class="max-h-[88vh] gap-0 p-0">
		<Sheet.Header class="border-b border-border px-4 pb-3 pt-2 text-left">
			<Sheet.Title class="text-base">{title}</Sheet.Title>
		</Sheet.Header>
		<div class="border-b border-border px-3 py-2">
			<Input
				type="search"
				bind:value={bibleFilter}
				placeholder="Filter books…"
				class="h-11 text-base"
				autocomplete="off"
			/>
		</div>
		{#if suggestions.length > 0 && bibleFilter.trim().length === 0}
			<div class="border-b border-border px-3 py-2">
				<p class="mb-2 text-xs font-medium text-muted-foreground">Suggestions</p>
				<div class="grid grid-cols-2 gap-2">
					{#each suggestions as name (name)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="h-10 justify-start truncate px-2 text-sm font-normal max-md:min-h-11"
							onclick={() => onPick(name)}
						>
							{name}
						</Button>
					{/each}
				</div>
			</div>
		{/if}
		<div class="max-h-[60vh] overflow-y-auto overscroll-contain px-2 py-2">
			{#each filteredNames as name (name)}
				<button
					type="button"
					class="flex min-h-12 w-full items-center rounded-md px-3 py-2.5 text-left text-base text-foreground hover:bg-muted max-md:min-h-11"
					onclick={() => onPick(name)}
				>
					{name}
				</button>
			{/each}
			{#if filteredNames.length === 0}
				<p class="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
