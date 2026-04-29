<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const nameError = $derived(
		form && 'nameError' in form ? (form as { nameError?: string }).nameError : undefined
	);
	const nameSuccess = $derived(
		form && 'nameSuccess' in form ? (form as { nameSuccess?: boolean }).nameSuccess : false
	);
	const passwordError = $derived(
		form && 'passwordError' in form ? (form as { passwordError?: string }).passwordError : undefined
	);
	const passwordSuccess = $derived(
		form && 'passwordSuccess' in form
			? (form as { passwordSuccess?: boolean }).passwordSuccess
			: false
	);

	let namePending = $state(false);
	let passwordPending = $state(false);

	let fullName = $state('');
	$effect(() => {
		fullName = data.profile?.full_name ?? '';
	});
</script>

<svelte:head>
	<title>Profile — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 pb-16 md:px-6 md:py-8 md:pb-10">
	<p class="mb-4">
		<a
			href="/settings"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronLeft class="size-4" />
			Settings
		</a>
	</p>

	<header class="mb-8 border-b border-border pb-6">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
		<p class="mt-1 text-sm text-muted-foreground">Account details and sign-in security.</p>
	</header>

	{#if data.loadError || !data.profile}
		<p class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{data.loadError ?? 'Profile not available.'}
		</p>
	{:else}
		<section class="mb-8 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Account</h2>
			<dl class="mt-4 space-y-3 text-sm">
				<div>
					<dt class="text-muted-foreground">Email</dt>
					<dd class="mt-0.5 font-medium text-foreground">{data.profile.email}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Role</dt>
					<dd class="mt-0.5 font-medium capitalize text-foreground">{data.profile.role}</dd>
				</div>
			</dl>
		</section>

		<section class="mb-8 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Display name</h2>
			<p class="mt-1 text-sm text-muted-foreground">Shown where your name appears in the app.</p>

			<form
				method="POST"
				action="?/updateName"
				class="mt-4 space-y-4"
				use:enhance={() => {
					namePending = true;
					return async ({ update }) => {
						namePending = false;
						await update();
					};
				}}
			>
				<div class="space-y-2">
					<Label for="full_name">Full name</Label>
					<Input id="full_name" name="full_name" type="text" autocomplete="name" bind:value={fullName} />
				</div>
				{#if nameError}
					<p class="text-sm text-destructive" role="alert">{nameError}</p>
				{/if}
				{#if nameSuccess}
					<p class="text-sm text-muted-foreground" role="status">Name saved.</p>
				{/if}
				<Button type="submit" disabled={namePending} hotkey="s" label={namePending ? 'Saving…' : 'Save name'} />
			</form>
		</section>

		<Separator class="mb-8" />

		<section class="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Password</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Change your password for this account. You will stay signed in on this device.
			</p>

			<form
				method="POST"
				action="?/changePassword"
				class="mt-4 space-y-4"
				use:enhance={() => {
					passwordPending = true;
					return async ({ update }) => {
						passwordPending = false;
						await update();
					};
				}}
			>
				<div class="space-y-2">
					<Label for="new_password">New password</Label>
					<Input
						id="new_password"
						name="new_password"
						type="password"
						autocomplete="new-password"
						minlength={8}
					/>
				</div>
				<div class="space-y-2">
					<Label for="confirm_password">Confirm new password</Label>
					<Input
						id="confirm_password"
						name="confirm_password"
						type="password"
						autocomplete="new-password"
						minlength={8}
					/>
				</div>
				{#if passwordError}
					<p class="text-sm text-destructive" role="alert">{passwordError}</p>
				{/if}
				{#if passwordSuccess}
					<p class="text-sm text-muted-foreground" role="status">Password updated.</p>
				{/if}
				<Button type="submit" variant="secondary" disabled={passwordPending}>
					{passwordPending ? 'Updating…' : 'Change password'}
				</Button>
			</form>
		</section>
	{/if}
</div>
