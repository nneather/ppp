<script lang="ts">
	import { browser } from '$app/environment';
	import { deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label';
	import type { PersonRow } from '$lib/types/library';
	import { cn } from '$lib/utils.js';

	export type PersonNamePrefill = {
		first_name?: string | null;
		middle_name?: string | null;
		last_name?: string | null;
		suffix?: string | null;
	};

	let {
		open = $bindable(false),
		person = null,
		prefill = null,
		people = [],
		/** Update path (edit mode). Kept as `actionPath` for existing call sites. */
		actionPath = '?/updatePerson',
		createActionPath = '?/createPerson',
		onSaved
	}: {
		open?: boolean;
		/** When set, dialog is edit mode. When null, create mode. */
		person?: PersonRow | null;
		/** Seed fields when opening create mode (e.g. typed autocomplete text). */
		prefill?: PersonNamePrefill | null;
		people?: PersonRow[];
		actionPath?: string;
		createActionPath?: string;
		onSaved?: (saved: PersonRow) => void | Promise<void>;
	} = $props();

	const isCreate = $derived(person == null);

	let firstName = $state('');
	let middleName = $state('');
	let lastName = $state('');
	let suffix = $state('');
	let aliases = $state<string[]>([]);
	let pending = $state(false);
	let message = $state<string | null>(null);
	let messageTone = $state<'error' | 'warning'>('error');
	let confirmedDuplicate = $state(false);
	/** Guards re-seed while the same open session is active. */
	let seedToken = $state<string | null>(null);

	function applyPrefill(p: PersonNamePrefill | null | undefined) {
		firstName = p?.first_name?.trim() ?? '';
		middleName = p?.middle_name?.trim() ?? '';
		lastName = p?.last_name?.trim() ?? '';
		suffix = p?.suffix?.trim() ?? '';
		aliases = [];
	}

	$effect(() => {
		if (!open) {
			seedToken = null;
			return;
		}
		if (person) {
			const token = `edit:${person.id}`;
			if (seedToken === token) return;
			seedToken = token;
			firstName = person.first_name ?? '';
			middleName = person.middle_name ?? '';
			lastName = person.last_name ?? '';
			suffix = person.suffix ?? '';
			aliases = [...(person.aliases ?? [])];
			message = null;
			messageTone = 'error';
			confirmedDuplicate = false;
			return;
		}
		const token = `create:${prefill?.last_name ?? ''}|${prefill?.first_name ?? ''}|${prefill?.middle_name ?? ''}|${prefill?.suffix ?? ''}`;
		if (seedToken === token) return;
		seedToken = token;
		applyPrefill(prefill);
		message = null;
		messageTone = 'error';
		confirmedDuplicate = false;
	});

	function onNameFieldEdit() {
		confirmedDuplicate = false;
		if (messageTone === 'warning') {
			message = null;
			messageTone = 'error';
		}
	}

	const viewBooksHref = $derived(
		person ? `/library?author_id=${encodeURIComponent(person.id)}` : null
	);

	function findCollidingPeople(first: string, last: string, excludeId: string | null): PersonRow[] {
		const lastLower = last.trim().toLowerCase();
		const initial = first.trim().charAt(0).toLowerCase();
		if (!lastLower) return [];
		return people.filter((p) => {
			if (excludeId && p.id === excludeId) return false;
			return (
				p.last_name.toLowerCase() === lastLower &&
				(p.first_name?.trim().charAt(0).toLowerCase() ?? '') === initial
			);
		});
	}

	async function submit() {
		if (!browser) return;
		if (lastName.trim().length === 0) {
			message = 'Last name is required.';
			messageTone = 'error';
			return;
		}
		if (!confirmedDuplicate) {
			const collisions = findCollidingPeople(
				firstName,
				lastName,
				isCreate ? null : (person?.id ?? null)
			);
			if (collisions.length > 0) {
				const names = collisions
					.map((p) => [p.first_name, p.last_name].filter(Boolean).join(' '))
					.join(', ');
				message = isCreate
					? `Already in your library: ${names}. Continue creating a separate person?`
					: `Another person already matches that name: ${names}. Save anyway (same person id — not a merge)?`;
				messageTone = 'warning';
				return;
			}
		}
		pending = true;
		message = null;
		messageTone = 'error';
		try {
			const fd = new FormData();
			fd.append('first_name', firstName);
			fd.append('middle_name', middleName);
			fd.append('last_name', lastName);
			fd.append('suffix', suffix);

			if (isCreate) {
				const resp = await fetch(createActionPath, {
					method: 'POST',
					headers: { 'x-sveltekit-action': 'true' },
					body: fd
				});
				const result = deserialize(await resp.text()) as ActionResult;
				if (result.type === 'success' || result.type === 'failure') {
					const data = (result.data ?? {}) as {
						kind?: string;
						personId?: string;
						success?: boolean;
						message?: string;
					};
					if (result.type === 'failure' || !data.personId) {
						message = data.message ?? 'Could not create person.';
						return;
					}
					const created: PersonRow = {
						id: data.personId,
						first_name: firstName.trim() || null,
						middle_name: middleName.trim() || null,
						last_name: lastName.trim(),
						suffix: suffix.trim() || null,
						aliases: []
					};
					open = false;
					await onSaved?.(created);
				} else {
					message = 'Network error creating person.';
				}
				return;
			}

			if (!person) return;
			fd.append('id', person.id);
			for (const a of aliases) {
				fd.append('aliases', a);
			}
			const resp = await fetch(actionPath, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as {
					kind?: string;
					personId?: string;
					success?: boolean;
					message?: string;
				};
				if (result.type === 'failure' || !data.success) {
					message = data.message ?? 'Could not update person.';
					return;
				}
				const updated: PersonRow = {
					...person,
					first_name: firstName.trim() || null,
					middle_name: middleName.trim() || null,
					last_name: lastName.trim(),
					suffix: suffix.trim() || null,
					aliases
				};
				open = false;
				await onSaved?.(updated);
			} else {
				message = 'Network error updating person.';
			}
		} catch (err) {
			console.error(err);
			message = isCreate ? 'Network error creating person.' : 'Network error updating person.';
		} finally {
			pending = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{isCreate ? 'Add person' : 'Edit person'}</Dialog.Title>
			<Dialog.Description>
				{#if isCreate}
					Last name is required. First / middle / suffix are optional but help with citations later.
				{:else}
					Updates this person everywhere they appear. Same person id — not a merge or new record.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if message}
			<p
				class={cn(
					'rounded-md border px-3 py-2 text-sm',
					messageTone === 'warning'
						? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
						: 'border-destructive/30 bg-destructive/10 text-destructive'
				)}
				role={messageTone === 'warning' ? 'status' : 'alert'}
			>
				{message}
			</p>
		{/if}

		<div class="flex flex-col gap-3">
			<div class="space-y-2">
				<Label for="person-edit-first">First name</Label>
				<Input
					id="person-edit-first"
					bind:value={firstName}
					class="h-11 text-base"
					oninput={onNameFieldEdit}
				/>
			</div>
			<div class="space-y-2">
				<Label for="person-edit-middle">Middle name</Label>
				<Input
					id="person-edit-middle"
					bind:value={middleName}
					class="h-11 text-base"
					oninput={onNameFieldEdit}
				/>
			</div>
			<div class="space-y-2">
				<Label for="person-edit-last">Last name <span class="text-destructive">*</span></Label>
				<Input
					id="person-edit-last"
					bind:value={lastName}
					class="h-11 text-base"
					required
					oninput={onNameFieldEdit}
				/>
			</div>
			<div class="space-y-2">
				<Label for="person-edit-suffix">Suffix</Label>
				<Input
					id="person-edit-suffix"
					bind:value={suffix}
					placeholder="Jr., III"
					class="h-11 text-base"
					oninput={onNameFieldEdit}
				/>
			</div>
		</div>

		{#if viewBooksHref}
			<p class="text-sm">
				<a
					href={viewBooksHref}
					class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				>
					View books
				</a>
			</p>
		{/if}

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="h-11"
				onclick={() => (open = false)}
				disabled={pending}
				hotkey="Escape"
				label="Cancel"
			/>
			{#if messageTone === 'warning' && message}
				<Button
					type="button"
					variant="default"
					class="h-11"
					onclick={() => {
						confirmedDuplicate = true;
						void submit();
					}}
					disabled={pending}
					hotkey="s"
					label={pending ? 'Saving…' : isCreate ? 'Continue anyway' : 'Save anyway'}
				/>
			{:else}
				<Button
					type="button"
					class="h-11"
					onclick={() => void submit()}
					disabled={pending}
					hotkey="s"
					label={pending ? 'Saving…' : isCreate ? 'Add person' : 'Save name'}
				/>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
