<script lang="ts">
  import { goto } from '$app/navigation'
  import { createClient } from '$lib/supabase/client'

  let email = $state('')
  let password = $state('')
  let error = $state('')
  let loading = $state(false)

  const supabase = createClient()

  async function handleLogin() {
    loading = true
    error = ''
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      error = authError.message
      loading = false
    } else {
      goto('/dashboard')
    }
  }
</script>

<div style="max-width: 400px; margin: 100px auto; padding: 2rem;">
  <h1>ppp</h1>
  <input type="email" placeholder="Email" bind:value={email} />
  <input type="password" placeholder="Password" bind:value={password} />
  {#if error}<p style="color: red">{error}</p>{/if}
  <button onclick={handleLogin} disabled={loading}>
    {loading ? 'Signing in…' : 'Sign in'}
  </button>
</div>