<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { deserialize } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { getBibleBookNames } from '$lib/library/bible-book-names';
	import { parsePassageDisplay, formatPassageRow } from '$lib/sermons/passage-parse';
	import {
		CONTEXT_TYPES,
		CONTEXT_TYPE_LABELS,
		type ContextType,
		type SermonListRow,
		type SermonPassageRow,
		type SermonVenueRow
	} from '$lib/types/sermons';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	type PassageDraft = {
		bible_book: string;
		chapter_start: string;
		verse_start: string;
		chapter_end: string;
		verse_end: string;
	};

	let {
		open = $bindable(false),
		mode,
		sermon = null,
		venues = $bindable([] as SermonVenueRow[]),
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		sermon?: SermonListRow | null;
		venues?: SermonVenueRow[];
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	const bibleBooks = getBibleBookNames();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let preachedOn = $state('');
	let venueId = $state('');
	let contextType = $state<ContextType | ''>('');
	let topic = $state('');
	let passageDisplay = $state('');
	let notes = $state('');
	let passages = $state<PassageDraft[]>([]);

	let newVenueName = $state('');
	let creatingVenue = $state(false);
	let venueCreateError = $state<string | null>(null);

	const NONE = '__none__';

	const venueSelectValue = $derived(venueId || NONE);
	const contextSelectValue = $derived(contextType || NONE);

	const formAction = $derived(mode === 'create' ? '?/createSermon' : '?/updateSermon');
	const sheetTitle = $derived(mode === 'create' ? 'New sermon' : 'Edit sermon');

	function passageToDraft(p: SermonPassageRow): PassageDraft {
		return {
			bible_book: p.bible_book,
			chapter_start: p.chapter_start != null ? String(p.chapter_start) : '',
			verse_start: p.verse_start != null ? String(p.verse_start) : '',
			chapter_end: p.chapter_end != null ? String(p.chapter_end) : '',
			verse_end: p.verse_end != null ? String(p.verse_end) : ''
		};
	}

	function emptyPassage(): PassageDraft {
		return {
			bible_book: '',
			chapter_start: '',
			verse_start: '',
			chapter_end: '',
			verse_end: ''
		};
	}

	function seedFromSermon() {
		if (mode === 'edit' && sermon) {
			preachedOn = sermon.preached_on;
			venueId = sermon.venue_id ?? '';
			contextType = sermon.context_type ?? '';
			topic = sermon.topic ?? '';
			passageDisplay = sermon.passage_display ?? '';
			notes = sermon.notes ?? '';
			passages = sermon.passages.length
				? sermon.passages.map(passageToDraft)
				: [];
		} else {
			preachedOn = '';
			venueId = '';
			contextType = '';
			topic = '';
			passageDisplay = '';
			notes = '';
			passages = [];
		}
		newVenueName = '';
		venueCreateError = null;
	}

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 768px)');
		const sync = () => {
			sheetSide = mq.matches ? 'right' : 'bottom';
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!open) return;
		untrack(() => seedFromSermon());
	});

	const passagesJson = $derived(
		JSON.stringify(
			passages
				.filter((p) => p.bible_book.trim())
				.map((p) => ({
					bible_book: p.bible_book.trim(),
					chapter_start: p.chapter_start.trim() ? Number.parseInt(p.chapter_start, 10) : null,
					verse_start: p.verse_start.trim() ? Number.parseInt(p.verse_start, 10) : null,
					chapter_end: p.chapter_end.trim() ? Number.parseInt(p.chapter_end, 10) : null,
					verse_end: p.verse_end.trim() ? Number.parseInt(p.verse_end, 10) : null
				}))
		)
	);

	const contextLabel = $derived(
		contextType ? CONTEXT_TYPE_LABELS[contextType] : 'None'
	);

	const venueLabel = $derived.by(() => {
		if (!venueId) return 'No venue';
		return venues.find((v) => v.id === venueId)?.name ?? 'Select venue';
	});

	function applyParseAssist() {
		const parsed = parsePassageDisplay(passageDisplay);
		if (!parsed.length) return;
		passages = parsed.map((p) => ({
			bible_book: p.bible_book,
			chapter_start: p.chapter_start != null ? String(p.chapter_start) : '',
			verse_start: p.verse_start != null ? String(p.verse_start) : '',
			chapter_end: p.chapter_end != null ? String(p.chapter_end) : '',
			verse_end: p.verse_end != null ? String(p.verse_end) : ''
		}));
	}

	async function createVenueInline() {
		const name = newVenueName.trim();
		if (!name || creatingVenue) return;
		creatingVenue = true;
		venueCreateError = null;
		try {
			const body = new FormData();
			body.set('name', name);
			const res = await fetch('?/createVenue', {
				method: 'POST',
				body,
				headers: { accept: 'application/json' }
			});
			const text = await res.text();
			const result = deserialize(text);
			if (result.type === 'success' && result.data && typeof result.data === 'object') {
				const data = result.data as {
					kind?: string;
					success?: boolean;
					venueId?: string;
					message?: string;
				};
				if (data.kind === 'createVenue' && data.success && data.venueId) {
					venues = [
						...venues,
						{ id: data.venueId, name, notes: null, sermonCount: 0 }
					].sort((a, b) => a.name.localeCompare(b.name));
					venueId = data.venueId;
					newVenueName = '';
					return;
				}
				venueCreateError = data.message ?? 'Could not create venue.';
			} else if (result.type === 'failure' && result.data && typeof result.data === 'object') {
				const data = result.data as { message?: string };
				venueCreateError = data.message ?? 'Could not create venue.';
			} else {
				venueCreateError = 'Could not create venue.';
			}
		} finally {
			creatingVenue = false;
		}
	}

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				Date is required; everything else can be filled in later.
			</Sheet.Description>
		</Sheet.Header>

		<form method="POST" action={formAction} use:enhance={onSubmit} class="flex flex-1 flex-col gap-4 px-1 py-4">
			{#if mode === 'edit' && sermon}
				<input type="hidden" name="sermon_id" value={sermon.id} />
			{/if}
			<input type="hidden" name="passages_json" value={passagesJson} />

			{#if errorMessage}
				<p class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
					{errorMessage}
				</p>
			{/if}

			<div class="space-y-2">
				<Label for="preached_on">Date</Label>
				<Input id="preached_on" name="preached_on" type="date" bind:value={preachedOn} required />
			</div>

			<div class="space-y-2">
				<Label>Venue</Label>
				<input type="hidden" name="venue_id" value={venueId} />
				<Select.Root
					type="single"
					value={venueSelectValue}
					onValueChange={(v) => {
						venueId = !v || v === NONE ? '' : v;
					}}
				>
					<Select.Trigger class="w-full">{venueLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NONE}>No venue</Select.Item>
						{#each venues as v (v.id)}
							<Select.Item value={v.id}>{v.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<div class="flex gap-2">
					<Input
						placeholder="New venue name"
						bind:value={newVenueName}
						class="flex-1"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								void createVenueInline();
							}
						}}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!newVenueName.trim() || creatingVenue}
						onclick={() => void createVenueInline()}
					>
						Add
					</Button>
				</div>
				{#if venueCreateError}
					<p class="text-xs text-destructive">{venueCreateError}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label>Context</Label>
				<input type="hidden" name="context_type" value={contextType} />
				<Select.Root
					type="single"
					value={contextSelectValue}
					onValueChange={(v) => {
						contextType = !v || v === NONE ? '' : (v as ContextType);
					}}
				>
					<Select.Trigger class="w-full">{contextLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NONE}>None</Select.Item>
						{#each CONTEXT_TYPES as ct (ct)}
							<Select.Item value={ct}>{CONTEXT_TYPE_LABELS[ct]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-2">
				<Label for="passage_display">Passage</Label>
				<div class="flex gap-2">
					<Input
						id="passage_display"
						name="passage_display"
						bind:value={passageDisplay}
						placeholder="e.g. Mark 1:16-34"
						class="flex-1"
					/>
					<Button type="button" variant="outline" size="sm" onclick={applyParseAssist}>
						Parse
					</Button>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="topic">Topic</Label>
				<Input id="topic" name="topic" bind:value={topic} placeholder="Sermon title (optional)" />
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-2">
					<Label>Structured passages</Label>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="gap-1"
						onclick={() => {
							passages = [...passages, emptyPassage()];
						}}
					>
						<Plus class="size-3.5" /> Add
					</Button>
				</div>
				{#if passages.length === 0}
					<p class="text-xs text-muted-foreground">
						Optional. Use Parse from the passage field, or add rows for library search.
					</p>
				{/if}
				{#each passages as p, i (i)}
					<div class="rounded-lg border border-border p-3 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<select
								class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
								bind:value={p.bible_book}
							>
								<option value="">Bible book…</option>
								{#each bibleBooks as book (book)}
									<option value={book}>{book}</option>
								{/each}
							</select>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Remove passage"
								onclick={() => {
									passages = passages.filter((_, j) => j !== i);
								}}
							>
								<Trash2 class="size-3.5" />
							</Button>
						</div>
						<div class="grid grid-cols-4 gap-2">
							<Input placeholder="Ch" inputmode="numeric" bind:value={p.chapter_start} />
							<Input placeholder="Vs" inputmode="numeric" bind:value={p.verse_start} />
							<Input placeholder="Ch end" inputmode="numeric" bind:value={p.chapter_end} />
							<Input placeholder="Vs end" inputmode="numeric" bind:value={p.verse_end} />
						</div>
						{#if p.bible_book}
							<p class="text-xs text-muted-foreground">
								{formatPassageRow({
									bible_book: p.bible_book,
									chapter_start: p.chapter_start ? Number.parseInt(p.chapter_start, 10) : null,
									verse_start: p.verse_start ? Number.parseInt(p.verse_start, 10) : null,
									chapter_end: p.chapter_end ? Number.parseInt(p.chapter_end, 10) : null,
									verse_end: p.verse_end ? Number.parseInt(p.verse_end, 10) : null
								})}
							</p>
						{/if}
					</div>
				{/each}
			</div>

			<div class="space-y-2">
				<Label for="notes">Notes</Label>
				<textarea
					id="notes"
					name="notes"
					bind:value={notes}
					rows={4}
					class="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="Outline, personal notes…"
				></textarea>
			</div>

			<div class="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-background pt-4 pb-1">
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
				<Button
					type="submit"
					hotkey={mode === 'create' ? 's' : 'u'}
					label={pending ? 'Saving…' : mode === 'create' ? 'Save sermon' : 'Update sermon'}
					disabled={pending || !preachedOn}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
