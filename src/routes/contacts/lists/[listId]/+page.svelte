<script lang="ts">
	import { invalidate } from '$app/navigation';
	import ContactListDetail from '$lib/components/contact-list-detail.svelte';
	import HouseholdFormSheet from '$lib/components/household-form-sheet.svelte';
	import type { HouseholdRow } from '$lib/types/contacts';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = { kind?: string; message?: string; success?: boolean; count?: number };
	const f = $derived((form ?? null) as FormShape | null);

	let sheetOpen = $state(false);
	let editing = $state<HouseholdRow | null>(null);
	const sheetError = $derived(
		f && f.success !== true && (f.kind === 'createHousehold' || f.kind === 'updateHousehold')
			? (f.message ?? null)
			: null
	);

	function editHousehold(id: string) {
		const h = data.households.find((x) => x.id === id);
		if (!h) return;
		editing = h;
		sheetOpen = true;
	}
</script>

<svelte:head><title>{data.list.name} · Contacts</title></svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-4">
	<a
		href="/contacts?tab=lists"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Lists
	</a>

	{#if data.loadError}
		<p class="mt-2 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	<div class="mt-2">
		<ContactListDetail
			list={data.list}
			members={data.members}
			hiddenRetiredOnlyCount={data.hiddenRetiredOnlyCount}
			householdCandidates={data.householdCandidates}
			contactCandidates={data.contactCandidates}
			todayYmd={data.todayYmd}
			form={f}
			onEditHousehold={editHousehold}
		/>
	</div>
</div>

<HouseholdFormSheet
	bind:open={sheetOpen}
	mode="edit"
	household={editing}
	lists={data.lists}
	memberListIds={editing ? (data.listIdsByHouseholdId[editing.id] ?? []) : []}
	gradeChanges={editing ? (data.gradeChangesByHouseholdId[editing.id] ?? []) : []}
	children={editing ? (data.childrenByHouseholdId[editing.id] ?? []) : []}
	errorMessage={sheetError}
	onSaved={() => invalidate('app:contacts:list')}
/>
