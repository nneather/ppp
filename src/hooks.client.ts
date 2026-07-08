import type { HandleClientError } from '@sveltejs/kit';
import { installClientRecovery } from '$lib/pwa/client-recovery';

installClientRecovery();

export const handleError: HandleClientError = ({ error, event }) => {
	console.error('[client]', event.url.pathname, error);
	return {
		message: 'Something went wrong loading this page.'
	};
};
