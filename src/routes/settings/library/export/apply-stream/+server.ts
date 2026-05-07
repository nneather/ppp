import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPreparedLibraryCsv, prepareLibraryBooksImport } from '$lib/library/server/books-csv';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const { data: profile, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (profileErr) console.error(profileErr);
	if ((profile?.role as string | null) !== 'owner') {
		error(403, 'Owner only');
	}

	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('multipart/form-data')) {
		error(400, 'Expected multipart form data');
	}

	const fd = await request.formData();
	const file = fd.get('csv_file');
	if (!file || !(file instanceof File)) {
		error(400, 'Missing import file');
	}

	const text = await file.text();

	const stream = new ReadableStream({
		async start(controller) {
			const enc = new TextEncoder();
			const write = (obj: Record<string, unknown>) => {
				controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
			};

			try {
				const prep = await prepareLibraryBooksImport(locals.supabase, text, { filename: file.name });
				if (!prep.ok) {
					write({ type: 'error', phase: 'prepare', errors: prep.errors });
					return;
				}

				write({ type: 'prepare', ok: true as const, format: prep.format });

				try {
					const summary = await applyPreparedLibraryCsv(
						locals.supabase,
						user.id,
						prep.prepared,
						(e) => {
							write({
								type: 'progress',
								phase: 'apply',
								done: e.done,
								total: e.total,
								op: e.opKind
							});
						}
					);
					if (summary.errors.length > 0) {
						const first = summary.errors[0]!;
						write({
							type: 'error',
							phase: 'apply',
							line: first.line,
							message: first.message,
							inserted: summary.inserted,
							updated: summary.updated,
							deleted: summary.deleted
						});
					} else {
						write({
							type: 'complete',
							inserted: summary.inserted,
							updated: summary.updated,
							deleted: summary.deleted
						});
					}
				} catch (e) {
					write({
						type: 'error',
						phase: 'apply',
						line: 0,
						message: e instanceof Error ? e.message : 'Unknown error'
					});
				}
			} catch (e) {
				write({
					type: 'error',
					phase: 'prepare',
					errors: [
						{
							line: 0,
							message: e instanceof Error ? e.message : 'Unexpected error while preparing import.'
						}
					]
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
};
