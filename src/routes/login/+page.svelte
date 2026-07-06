<script lang="ts">
	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase/client';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	const supabase = createClient();

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		error = '';
		const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
		if (authError) {
			error = authError.message;
			loading = false;
		} else {
			await goto('/dashboard');
		}
	}
</script>

<svelte:head>
	<title>Sign in — ppp</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
	<div class="w-full max-w-sm">
		<div class="mb-6 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">ppp</h1>
			<p class="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
		</div>

		<form
			onsubmit={handleLogin}
			class="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
		>
			<div class="flex flex-col gap-1.5">
				<Label for="email">Email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					disabled={loading}
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="password">Password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					disabled={loading}
				/>
			</div>

			{#if error}
				<p
					class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{error}
				</p>
			{/if}

			<Button
				type="submit"
				class="w-full"
				hotkey="s"
				label={loading ? 'Signing in…' : 'Sign in'}
				disabled={loading}
			/>
		</form>
	</div>
</div>
