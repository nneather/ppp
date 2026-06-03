import type { PostgrestError } from '@supabase/supabase-js';

export type OpResult<T> = { data: T | null; error: PostgrestError | null };

export function formatError(error: PostgrestError | null): string {
	if (!error) return '(no error)';
	return `${error.code ?? '?'} ${error.message}${error.details ? ` — ${error.details}` : ''}`;
}

export function expectOk<T>(label: string, result: OpResult<T>): T {
	if (result.error) {
		throw new Error(`[FAIL] ${label}: expected success, got ${formatError(result.error)}`);
	}
	return result.data as T;
}

export function expectDenied(label: string, result: OpResult<unknown>): PostgrestError {
	if (!result.error) {
		throw new Error(`[FAIL] ${label}: expected denial, got success`);
	}
	return result.error;
}

export function expectDeniedCode(
	label: string,
	result: OpResult<unknown>,
	codes: string[]
): PostgrestError {
	const err = expectDenied(label, result);
	if (err.code && !codes.includes(err.code)) {
		throw new Error(
			`[FAIL] ${label}: expected code ${codes.join('|')}, got ${formatError(err)}`
		);
	}
	return err;
}

export function expectMessageIncludes(
	label: string,
	error: PostgrestError,
	substring: string
): void {
	if (!error.message.toLowerCase().includes(substring.toLowerCase())) {
		throw new Error(
			`[FAIL] ${label}: expected message containing "${substring}", got ${formatError(error)}`
		);
	}
}
