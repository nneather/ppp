<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		buildBackHtml,
		inkFreeGuide,
		POSTCARD_SIZES,
		SIZE_DIMENSIONS,
		type PostcardSize
	} from '$lib/contacts/postcard-artwork';
	import { defaultSelected } from '$lib/contacts/postcards';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormResult = {
		kind?: string;
		success?: boolean;
		message?: string | null;
		count?: number;
	} | null;
	const f = $derived((form ?? null) as FormResult);
	const errFor = (k: string) => (f?.kind === k && f.success !== true ? (f.message ?? null) : null);

	/* ── Artwork (local editable copy of the saved design) ─────────────── */
	// Seeded once from the saved design; the form is the source of truth until Save.
	let size = $state<PostcardSize>(untrack(() => data.design.size));
	let backMode = $state<'message' | 'upload'>(untrack(() => data.design.back_mode));
	let backMessage = $state(untrack(() => data.design.back_message));
	let saving = $state(false);
	let dirty = $state(false);

	const dims = $derived(SIZE_DIMENSIONS[size]);
	const backHtml = $derived(buildBackHtml(backMessage, size));
	const guide = $derived(inkFreeGuide(size));
	/** Width of the back preview box; the 1:1 (inches) iframe is scaled to fit it. */
	let backBoxWidth = $state(0);
	const PX_PER_IN = 96;
	const backScale = $derived(backBoxWidth ? backBoxWidth / (dims.widthIn * PX_PER_IN) : 0.4);
	const frontIsPdf = $derived((data.design.front_path ?? '').endsWith('.pdf'));
	const backIsPdf = $derived((data.design.back_path ?? '').endsWith('.pdf'));

	const saveEnhance: SubmitFunction = () => {
		saving = true;
		return async ({ result, update }) => {
			saving = false;
			await update({ reset: false });
			if (result.type === 'success') dirty = false;
		};
	};
	const uploadEnhance: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ reset: true });
		};
	};

	/* ── Recipients ─────────────────────────────────────────────────────── */
	let selected = $state<Set<string>>(untrack(() => new Set(defaultSelected(data.recipients))));
	const counts = $derived({
		confirmed: data.recipients.filter((r) => r.status === 'confirmed' && !r.sent).length,
		unconfirmed: data.recipients.filter((r) => r.status === 'unconfirmed' && !r.sent).length,
		none: data.recipients.filter((r) => r.status === 'none').length,
		sent: data.recipients.filter((r) => r.sent).length
	});
	const selectedIds = $derived(
		data.recipients.filter((r) => selected.has(r.householdId) && !r.sent).map((r) => r.householdId)
	);
	function toggle(id: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(id);
		else next.delete(id);
		selected = next;
	}
	function selectConfirmed() {
		selected = new Set(defaultSelected(data.recipients));
	}

	const estimate = $derived(
		data.design.price_cents != null
			? `est. $${((data.design.price_cents * selectedIds.length) / 100).toFixed(2)}`
			: null
	);
	const proofs = $derived(data.sends.filter((s) => s.kind === 'proof').slice(0, 6));
	const liveSends = $derived(data.sends.filter((s) => s.kind !== 'proof'));
	const ready = $derived(data.problems.length === 0 && !dirty);

	/* ── Live batch: confirm, then loop chunks until done or an error ──── */
	let confirmOpen = $state(false);
	let sending = $state(false);
	let progress = $state<{ mailed: number; total: number; error: string | null } | null>(null);

	async function runBatch() {
		confirmOpen = false;
		if (sending) return; // double-click / second confirm
		const queue = [...selectedIds];
		sending = true;
		progress = { mailed: 0, total: queue.length, error: null };
		while (queue.length) {
			const chunk = queue.splice(0, data.chunkSize);
			const body = new FormData();
			body.set('confirm', 'send');
			for (const id of chunk) body.append('household_id', id);
			let r: { mailed?: number; success?: boolean; message?: string | null } = {};
			try {
				const res = await fetch('?/sendBatch', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' }
				});
				const parsed = deserialize(await res.text());
				r = parsed.type === 'success' || parsed.type === 'failure' ? (parsed.data ?? {}) : {};
				if (parsed.type === 'error') r = { success: false, message: 'Server error.' };
			} catch (e) {
				r = { success: false, message: e instanceof Error ? e.message : 'Network error.' };
			}
			// Anything but an explicit success (failure, redirect on an expired
			// session, a malformed reply) stops the loop.
			const ok = r.success === true;
			progress = {
				...progress,
				mailed: progress.mailed + (r.mailed ?? 0),
				error: ok
					? null
					: (r.message ?? 'Send stopped — reload and check the list before continuing.')
			};
			if (!ok) break;
		}
		sending = false;
		await invalidate('app:postcards');
		selected = new Set(defaultSelected(data.recipients));
	}

	/** True while a proof / mail-to-me request is in flight (blocks double-clicks). */
	let submitting = $state(false);
	const sendEnhance: SubmitFunction = ({ cancel }) => {
		if (submitting) {
			cancel();
			return;
		}
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			await update({ reset: false });
		};
	};

	function statusBadge(status: string) {
		return status === 'confirmed'
			? { text: 'Confirmed', cls: 'text-emerald-700 dark:text-emerald-400' }
			: status === 'unconfirmed'
				? { text: 'Unconfirmed', cls: 'text-amber-700 dark:text-amber-400' }
				: { text: 'No address', cls: 'text-muted-foreground' };
	}
</script>

<svelte:head><title>Postcards · {data.list.name}</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 py-4">
	<div class="flex flex-wrap items-center gap-2">
		<a
			href="/contacts?tab=lists&list={data.list.id}"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="size-4" /> Contacts › {data.list.name}
		</a>
	</div>
	<h1 class="mt-1 text-xl font-semibold tracking-tight">Postcards</h1>

	<div class="mt-4 grid gap-4 lg:grid-cols-2">
		<!-- ① Artwork -->
		<section class="min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<h2 class="text-sm font-semibold">① Artwork</h2>

			<form
				method="POST"
				action="?/saveDesign"
				use:enhance={saveEnhance}
				class="mt-3 space-y-3"
				oninput={() => (dirty = true)}
			>
				<div class="flex flex-wrap items-end gap-3">
					<div class="space-y-1">
						<Label for="pc-size">Size</Label>
						<select
							id="pc-size"
							name="size"
							bind:value={size}
							class="h-9 rounded-md border border-input bg-background px-2 text-sm"
						>
							{#each POSTCARD_SIZES as s (s)}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<p class="pb-2 text-xs text-muted-foreground">Artwork: {dims.label} incl. bleed</p>
				</div>

				<fieldset class="space-y-2">
					<legend class="text-sm font-medium">Back</legend>
					<div class="flex gap-4 text-sm">
						<label class="flex items-center gap-1.5">
							<input type="radio" name="back_mode" value="message" bind:group={backMode} />
							Message
						</label>
						<label class="flex items-center gap-1.5">
							<input type="radio" name="back_mode" value="upload" bind:group={backMode} />
							Upload
						</label>
					</div>
					{#if backMode === 'message'}
						<textarea
							name="back_message"
							bind:value={backMessage}
							rows={5}
							placeholder="Merry Christmas from …"
							class="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						></textarea>
					{:else}
						<input type="hidden" name="back_message" value={backMessage} />
					{/if}
				</fieldset>

				<details class="rounded-md border border-border px-3 py-2" open={!data.design.return_name}>
					<summary class="cursor-pointer text-sm font-medium">
						Return address
						{#if data.design.return_name}
							<span class="font-normal text-muted-foreground">
								· {data.design.return_name}, {data.design.return_city}
							</span>
						{/if}
					</summary>
					<p class="mt-1 text-xs text-muted-foreground">
						Printed by Lob on the back. "Mail one to me" goes here too.
					</p>
					<div class="mt-2 grid grid-cols-6 gap-2">
						<Input
							class="col-span-6"
							name="return_name"
							placeholder="Name"
							value={data.design.return_name ?? ''}
						/>
						<Input
							class="col-span-6"
							name="return_line_1"
							placeholder="Street"
							value={data.design.return_line_1 ?? ''}
						/>
						<Input
							class="col-span-6"
							name="return_line_2"
							placeholder="Apt / unit (optional)"
							value={data.design.return_line_2 ?? ''}
						/>
						<Input
							class="col-span-3"
							name="return_city"
							placeholder="City"
							value={data.design.return_city ?? ''}
						/>
						<Input
							class="col-span-1"
							name="return_state"
							placeholder="ST"
							maxlength={2}
							value={data.design.return_state ?? ''}
						/>
						<Input
							class="col-span-2"
							name="return_zip"
							placeholder="Zip"
							value={data.design.return_zip ?? ''}
						/>
					</div>
				</details>

				<div class="flex flex-wrap items-end justify-between gap-3">
					<div class="space-y-1">
						<Label for="pc-price">Price per card ($, from Lob dashboard)</Label>
						<Input
							id="pc-price"
							name="price"
							inputmode="decimal"
							class="w-28"
							placeholder="0.905"
							value={data.design.price_cents != null
								? (data.design.price_cents / 100).toFixed(2)
								: ''}
						/>
					</div>
					<Button type="submit" disabled={saving}
						>{saving ? 'Saving…' : 'Save artwork settings'}</Button
					>
				</div>
				{#if errFor('saveDesign')}
					<p class="text-sm text-destructive" role="alert">{errFor('saveDesign')}</p>
				{/if}
				{#if dirty}
					<p class="text-xs text-amber-700 dark:text-amber-400">
						Unsaved changes — save before proofs or sending.
					</p>
				{/if}
			</form>

			<!-- Uploads -->
			<div class="mt-4 grid gap-2 sm:grid-cols-2">
				{#each backMode === 'upload' ? ['front', 'back'] : ['front'] as side (side)}
					<form
						method="POST"
						action="?/uploadArtwork"
						enctype="multipart/form-data"
						use:enhance={uploadEnhance}
						class="min-w-0 space-y-1 rounded-md border border-dashed border-border p-2"
					>
						<input type="hidden" name="side" value={side} />
						<Label class="text-xs capitalize">{side} (PDF, PNG, JPG)</Label>
						<div class="flex items-center gap-2">
							<input
								type="file"
								name="file"
								accept="application/pdf,image/png,image/jpeg"
								class="w-0 min-w-0 flex-1 text-xs"
							/>
							<Button type="submit" size="sm" variant="secondary">Upload</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							{(side === 'front' ? data.design.front_path : data.design.back_path)
								? '✓ uploaded'
								: 'none yet'}
						</p>
					</form>
				{/each}
			</div>
			{#if errFor('uploadArtwork')}
				<p class="mt-2 text-sm text-destructive" role="alert">{errFor('uploadArtwork')}</p>
			{/if}

			<!-- Preview -->
			<div class="mt-4 grid gap-3 sm:grid-cols-2">
				<figure class="space-y-1">
					<figcaption class="text-xs text-muted-foreground">Front</figcaption>
					<div
						class="relative overflow-hidden rounded border border-border bg-muted"
						style="aspect-ratio: {dims.widthIn} / {dims.heightIn}"
					>
						{#if data.frontUrl && !frontIsPdf}
							<img src={data.frontUrl} alt="Front artwork" class="size-full object-cover" />
						{:else if data.frontUrl}
							<iframe title="Front artwork" src={data.frontUrl} class="size-full"></iframe>
						{:else}
							<p class="grid size-full place-items-center text-xs text-muted-foreground">
								No front yet
							</p>
						{/if}
					</div>
				</figure>
				<figure class="space-y-1">
					<figcaption class="text-xs text-muted-foreground">
						Back {backMode === 'message' ? '· dashed box = Lob address/postage' : ''}
					</figcaption>
					<div
						class="relative overflow-hidden rounded border border-border bg-white"
						style="aspect-ratio: {dims.widthIn} / {dims.heightIn}"
						bind:clientWidth={backBoxWidth}
					>
						{#if backMode === 'message'}
							<iframe
								title="Back preview"
								srcdoc={backHtml}
								class="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
								style="width:{dims.widthIn}in;height:{dims.heightIn}in;transform:scale({backScale})"
							></iframe>
							<div
								class="pointer-events-none absolute border border-dashed border-sky-500/70"
								style="right:{(guide.right / dims.widthIn) * 100}%;bottom:{(guide.bottom /
									dims.heightIn) *
									100}%;width:{(guide.widthIn / dims.widthIn) * 100}%;height:{(guide.heightIn /
									dims.heightIn) *
									100}%"
							></div>
						{:else if data.backUrl && !backIsPdf}
							<img src={data.backUrl} alt="Back artwork" class="size-full object-cover" />
						{:else if data.backUrl}
							<iframe title="Back artwork" src={data.backUrl} class="size-full"></iframe>
						{:else}
							<p class="grid size-full place-items-center text-xs text-muted-foreground">
								No back yet
							</p>
						{/if}
					</div>
				</figure>
			</div>
		</section>

		<div class="min-w-0 space-y-4">
			<!-- ② Recipients -->
			<section class="rounded-lg border border-border bg-card p-4 text-card-foreground">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="text-sm font-semibold">② Recipients</h2>
					<p class="text-xs text-muted-foreground">
						<span class="font-medium text-foreground">{selectedIds.length} selected</span>
						· {counts.confirmed} confirmed · {counts.unconfirmed} unconfirmed · {counts.none} no address
						{#if counts.sent}· {counts.sent} mailed{/if}
					</p>
				</div>
				<div class="mt-2 flex gap-2">
					<Button type="button" size="sm" variant="outline" onclick={selectConfirmed}
						>Select confirmed</Button
					>
					<Button type="button" size="sm" variant="ghost" onclick={() => (selected = new Set())}
						>Clear</Button
					>
				</div>
				<ul
					class="mt-2 max-h-[28rem] divide-y divide-border overflow-y-auto rounded-md border border-border"
				>
					{#each data.recipients as r (r.householdId)}
						{@const b = statusBadge(r.status)}
						<li>
							<label
								class="flex items-center gap-2 px-2 py-1.5 {r.status !== 'confirmed' || r.sent
									? 'opacity-60'
									: ''}"
							>
								<input
									type="checkbox"
									class="size-4 shrink-0 rounded border-input"
									checked={selected.has(r.householdId) && !r.sent}
									disabled={r.status !== 'confirmed' || r.sent}
									onchange={(e) => toggle(r.householdId, e.currentTarget.checked)}
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm">{r.label}</span>
									<span class="block truncate text-xs text-muted-foreground"
										>{r.address || '—'}</span
									>
								</span>
								{#if r.sent}
									{#if r.pending}
										<Badge
											variant="outline"
											class="shrink-0 text-destructive"
											title="Reserved, but the Lob result was never saved. Check the Lob dashboard before resending."
										>
											Pending — check Lob
										</Badge>
									{:else}
										<Badge variant="secondary" class="shrink-0">Mailed</Badge>
									{/if}
								{:else}
									<span class="shrink-0 text-xs {b.cls}">{b.text}</span>
								{/if}
							</label>
						</li>
					{/each}
				</ul>
			</section>

			<!-- ③ Proof & send -->
			<section class="rounded-lg border border-border bg-card p-4 text-card-foreground">
				<h2 class="text-sm font-semibold">③ Proof &amp; send</h2>
				{#if !data.keys.test || !data.keys.live}
					<p class="mt-2 text-xs text-amber-700 dark:text-amber-400">
						Lob keys missing:
						{[!data.keys.test && 'LOB_TEST_API_KEY', !data.keys.live && 'LOB_LIVE_API_KEY']
							.filter(Boolean)
							.join(', ')} — add to <code>.env.local</code> and Vercel.
					</p>
				{/if}
				{#if data.problems.length}
					<ul class="mt-2 list-disc pl-5 text-xs text-muted-foreground">
						{#each data.problems as p (p)}<li>{p}</li>{/each}
					</ul>
				{/if}

				<div class="mt-3 space-y-2">
					<form
						method="POST"
						action="?/sendProofs"
						use:enhance={sendEnhance}
						class="flex flex-wrap items-center gap-2"
					>
						{#each selectedIds.slice(0, 3) as id (id)}
							<input type="hidden" name="household_id" value={id} />
						{/each}
						<Button
							type="submit"
							size="sm"
							variant="outline"
							disabled={!ready || !data.keys.test || !selectedIds.length}
						>
							Test proofs (free)
						</Button>
						<span class="text-xs text-muted-foreground"
							>PDF proofs for the first 3 selected · mails nothing</span
						>
					</form>
					{#if errFor('sendProofs')}<p class="text-sm text-destructive" role="alert">
							{errFor('sendProofs')}
						</p>{/if}
					{#if proofs.length}
						<ul class="space-y-0.5 pl-1 text-xs">
							{#each proofs as p (p.id)}
								<li>
									{#if p.lob_url}
										<a
											href={p.lob_url}
											target="_blank"
											rel="noopener"
											class="underline underline-offset-2">Proof · {p.recipient_name}</a
										>
									{:else}
										<span class="text-destructive"
											>Proof failed · {p.recipient_name}: {p.error}</span
										>
									{/if}
									<span class="text-muted-foreground"> · {p.sent_on}</span>
								</li>
							{/each}
						</ul>
						<p class="text-xs text-muted-foreground">
							A new proof link can take ~1 minute to render.
						</p>
					{/if}

					<form
						method="POST"
						action="?/sendSelf"
						use:enhance={sendEnhance}
						class="flex flex-wrap items-center gap-2"
					>
						<Button
							type="submit"
							size="sm"
							variant="outline"
							disabled={!ready || !data.keys.live || !data.design.return_name || submitting}
						>
							Mail one to me
						</Button>
						<span class="text-xs text-muted-foreground"
							>Real card to the return address{data.design.price_cents != null
								? ` · ~$${(data.design.price_cents / 100).toFixed(2)}`
								: ''}</span
						>
					</form>
					{#if errFor('sendSelf')}<p class="text-sm text-destructive" role="alert">
							{errFor('sendSelf')}
						</p>{/if}
					{#if f?.kind === 'sendSelf' && f.success}<p
							class="text-sm text-emerald-700 dark:text-emerald-400"
						>
							Sent to you.
						</p>{/if}

					<div class="border-t border-border pt-3">
						<Button
							type="button"
							disabled={!ready || !data.keys.live || !selectedIds.length || sending}
							onclick={() => (confirmOpen = true)}
						>
							{sending
								? `Sending… ${progress?.mailed ?? 0}/${progress?.total ?? 0}`
								: `Send ${selectedIds.length}${estimate ? ` · ${estimate}` : ''}`}
						</Button>
						{#if progress && !sending}
							<p
								class="mt-2 text-sm {progress.error
									? 'text-destructive'
									: 'text-emerald-700 dark:text-emerald-400'}"
								role="status"
							>
								Mailed {progress.mailed} of {progress.total}.{progress.error
									? ` ${progress.error}`
									: ''}
							</p>
						{/if}
					</div>

					<p class="text-xs text-muted-foreground">
						History: {liveSends.filter((s) => s.kind === 'batch' && s.status === 'created').length} mailed
						from this list
						{#if liveSends.some((s) => s.status === 'failed')}
							· {liveSends.filter((s) => s.status === 'failed').length} failed
						{/if}
					</p>
				</div>
			</section>
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Mail {selectedIds.length} postcards?"
	description="Real postcards go to {selectedIds.length} households through Lob{estimate
		? ` (${estimate})`
		: ''}. Households already mailed from this list are skipped. This can't be undone."
	confirmLabel="Send {selectedIds.length}"
	onConfirm={runBatch}
/>
