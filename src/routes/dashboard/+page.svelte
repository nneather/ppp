<script lang="ts">
	let { data } = $props();
</script>

<div style="max-width: 600px; margin: 100px auto; padding: 2rem;">
	<h1>Dashboard</h1>
	<p>You are signed in.</p>
	{#if data.user?.email}
		<p>Signed in as <strong>{data.user.email}</strong></p>
	{/if}
</div>
