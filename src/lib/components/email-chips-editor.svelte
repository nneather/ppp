<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let {
		value = $bindable<string[]>([]),
		fieldName,
		label = 'Email addresses',
		placeholder = 'name@example.com',
		inputId
	}: {
		value: string[];
		fieldName: string;
		label?: string;
		placeholder?: string;
		inputId: string;
	} = $props();

	let draft = $state('');
	let invalid = $state(false);

	function tryAdd(raw: string): boolean {
		const t = raw.trim();
		if (!t) return false;
		if (!EMAIL_RE.test(t)) {
			invalid = true;
			return false;
		}
		if (value.includes(t)) {
			draft = '';
			return true;
		}
		value = [...value, t];
		draft = '';
		invalid = false;
		return true;
	}

	function commitDraft() {
		const t = draft.trim();
		if (!t) {
			invalid = false;
			return;
		}
		tryAdd(t);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			tryAdd(draft);
		}
	}

	function remove(i: number) {
		value = value.filter((_, idx) => idx !== i);
	}
</script>

<!-- Hidden inputs carry the array values to the form action under fieldName[]. -->
{#each value as addr (addr)}
	<input type="hidden" name={fieldName} value={addr} />
{/each}

<div class="space-y-2">
	<label for={inputId} class="text-sm font-medium leading-none text-foreground">{label}</label>
	{#if value.length > 0}
		<ul class="flex flex-wrap gap-1.5">
			{#each value as addr, i (addr)}
				<li
					class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs text-foreground"
				>
					<span class="break-all">{addr}</span>
					<button
						type="button"
						class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={`Remove ${addr}`}
						onclick={() => remove(i)}
					>
						<X class="size-3" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="flex gap-2">
		<Input
			id={inputId}
			type="email"
			autocomplete="email"
			{placeholder}
			bind:value={draft}
			onkeydown={handleKeydown}
			onblur={commitDraft}
			aria-invalid={invalid}
			class="h-9 flex-1"
		/>
		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={() => tryAdd(draft)}
			disabled={draft.trim().length === 0}
		>
			Add
		</Button>
	</div>
	{#if invalid}
		<p class="text-xs text-destructive" role="alert">Enter a valid email address.</p>
	{/if}
</div>
