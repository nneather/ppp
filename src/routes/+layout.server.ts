import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();

	// Allow unauthenticated access to /login only
	if (!user && url.pathname !== '/login') {
		redirect(303, '/login');
	}

	// If logged in and hitting /login, send to dashboard
	if (user && url.pathname === '/login') {
		redirect(303, '/dashboard');
	}

	return { user };
};
