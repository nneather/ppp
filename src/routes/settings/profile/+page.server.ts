import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { data: row, error } = await locals.supabase
		.from('profiles')
		.select('email, full_name, role')
		.eq('id', user.id)
		.maybeSingle();

	if (error) {
		console.error(error);
		return {
			profile: null as { email: string; full_name: string | null; role: string } | null,
			loadError: 'Could not load profile.'
		};
	}

	if (!row) {
		return {
			profile: null,
			loadError: 'Profile not found.'
		};
	}

	const p = row as { email: string; full_name: string | null; role: string };
	return {
		profile: {
			email: p.email,
			full_name: p.full_name,
			role: p.role
		},
		loadError: null as string | null
	};
};

export const actions: Actions = {
	updateName: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { nameError: 'Unauthorized' });

		const fd = await request.formData();
		const full_name = String(fd.get('full_name') ?? '').trim();

		const { error } = await locals.supabase
			.from('profiles')
			.update({ full_name: full_name.length > 0 ? full_name : null })
			.eq('id', user.id);

		if (error) {
			console.error(error);
			return fail(500, { nameError: error.message ?? 'Could not update name.' });
		}

		return { nameSuccess: true as const };
	},

	changePassword: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { passwordError: 'Unauthorized' });

		const fd = await request.formData();
		const new_password = String(fd.get('new_password') ?? '');
		const confirm_password = String(fd.get('confirm_password') ?? '');

		if (new_password.length < 8) {
			return fail(400, { passwordError: 'Password must be at least 8 characters.' });
		}
		if (new_password !== confirm_password) {
			return fail(400, { passwordError: 'Passwords do not match.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password: new_password });

		if (error) {
			console.error(error);
			return fail(400, { passwordError: error.message ?? 'Could not change password.' });
		}

		return { passwordSuccess: true as const };
	}
};
